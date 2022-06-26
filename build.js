import { promises, createWriteStream } from 'fs'
import db from './db.js'
import storage from './storage.js'
import Compool from './compool.js'
import Depg from './depg.js'
import Tasklist from './tasklist.js'

const fs = promises

const Result = {
    CompileFailed: 'C',
    FileNotUploaded: 'U',
    UnmetDependency: 'D',
    LinkingFailed: 'L',
    OK: '+',
}
const minioFilesBucket = 'projsrc'
const minioTargetsBucket = 'buildtar'

const root = process.argv[2]
let compool = new Compool(Number(process.env.BUILD_POOL_SIZE));

function projectDir(pid) {
    return `${root}/projects/${pid}`
}

async function fsExists(path) {
    try {
        await fs.access(path);
        return true;
    }
    catch (err) {
        return false;
    }
}

async function makeProjectDir(pid) {
    const projdir = projectDir(pid);
    await fs.mkdir(`${projdir}/objects/`, { recursive: true });
    await fs.mkdir(`${projdir}/targets/`, { recursive: true });
}

async function makeTree(tree, path, map) {
    if (!isNaN(tree)) {
        map[String(tree)] = { path, version: 0 }
    }
    else {
        await fs.mkdir(path);
        for (const ch in tree)
            await makeTree(tree[ch], `${path}/${ch}`, map);
    }
}

async function makeSrcDir(pid, tree) {
    const srcDir = `${projectDir(pid)}/src`;
    if (await fsExists(srcDir)) {
        await fs.rm(srcDir, { recursive: true, force: true });
    }
    let map = {};
    await makeTree(tree, srcDir, map)
    return map
}

async function getVersionList(pid) {
    const versionFile = `${projectDir(pid)}/version.json`;
    let versionList;
    if (!await fsExists(versionFile)) {
        versionList = { config: 0, files: {} };
    }
    else {
        versionList = JSON.parse(await fs.readFile(versionFile));
    }
    return versionList;
}

async function updateFile(objkey, path) {
    return new Promise(async (res, rej) => {
        try {
            let strm = await storage.getObject(minioFilesBucket, objkey);
            strm.pipe(createWriteStream(path));
            res();
        }
        catch (err) {
            rej(err)
        }
    })
}

function mapdbFiles(list) {
    let map = {}
    for (const f of list) {
        const { id, version, key } = f;
        map[`${id}`] = { version, key };
    }
    return map;
}

function createDepGrapgh(targets, versionList, dbFiles) {
    let graph = new Depg();
    for (const tar in targets) {
        const target = targets[tar];
        graph.add(`T${tar}`, true);
        for (const dep of target.dependency || []) {
            if (dep in targets) {
                graph.add(`T${dep}`, true);
                graph.dep(`T${tar}`, `T${dep}`);
            }
        }
        for (const fid of target.src) {
            const dbFile = dbFiles[`${fid}`];
            const localFile = versionList.files[`${fid}`];
            graph.add(`S${fid}`, false);
            graph.add(`O${fid}`, false);
            graph.dep(`O${fid}`, `S${fid}`);
            graph.dep(`T${tar}`, `O${fid}`);
            if (dbFile)
                if (dbFile.version > localFile.version) {
                    localFile.version = dbFile.version;
                }
                else {
                    graph.intact(`S${fid}`);
                }
        }
    }
    return graph;
}

async function makeTarget(pid, tar, targets, dbFiles, versionList) {
    const kind = tar[0];
    if (kind == 'S') {
        const fid = tar.slice(1);
        if (!dbFiles[fid])
            return false;
        await updateFile(dbFiles[fid].key, versionList.files[fid].path);
        return true;
    }
    else if (kind == 'O') {
        const fid = tar.slice(1);
        return await compool.compile(versionList.files[fid].path, `${projectDir(pid)}/objects/${fid}.o`);
    }
    else { // target
        tar = tar.slice(1);
        const objs = targets[tar].src.map((s) => { return `${projectDir(pid)}/objects/${s}.o`; })
        return await compool.link(objs, targets[tar].dependency || [], `${projectDir(pid)}/targets/${tar}`);
    }
}

function getStates(depg) {
    let files = {};
    let targets = {};
    const { failed, resolved, depfailed } = depg.states();
    for (const f of failed) {
        const kind = f[0]
        const id = f.slice(1)
        if (kind == 'S')
            files[id] = Result.FileNotUploaded;
        else if (kind == 'O')
            files[id] = Result.CompileFailed;
        else if (kind == 'T')
            targets[id] = Result.LinkingFailed;
    }
    for (const f of depfailed) {
        const kind = f[0]
        const id = f.slice(1)
        if (kind == 'T')
            targets[id] = Result.UnmetDependency;
    }
    for (const f of resolved) {
        const kind = f[0]
        const id = f.slice(1)
        if (kind == 'O' || kind == 'S')
            files[id] = Result.OK;
        else {
            targets[id] = Result.OK;
        }
    }
    return { files, targets };
}

async function makeAll(pid, depg, dbFiles, targets, versionList) {
    let tasks = new Tasklist();
    let glog = '';
    let success = true;
    while (!depg.end()) {
        const rdy = depg.ready();
        for (const tar of rdy) {
            depg.mask(tar);
            tasks.append(tar, makeTarget(pid, tar, targets, dbFiles, versionList))
        }
        const { key, result } = await tasks.wait();
        const kind = key[0];
        if (kind == 'S') {
            if (result)
                depg.resolve(key);
            else {
                success = false;
                depg.fail(key);
            }
        }
        else {
            const { status, log } = result;
            if (status == 0)
                depg.resolve(key)
            else {
                success = false;
                depg.fail(key)
            }
            if (log.length)
                if (kind == 'T')
                    glog += `----> target ${key.slice(1)}\n\n${log}\n\n`;
                else
                    glog += `----> ${versionList.files[key.slice(1)].path}\n\n${log}\n\n`;
        }
    }
    const rsl = getStates(depg);
    return { log: glog, files: rsl.files, targets: rsl.targets, success };
}

async function updateVersionList(pid, versionList) {
    await fs.writeFile(`${projectDir(pid)}/version.json`, JSON.stringify(versionList));
}

async function uploadResults(pid, bid, targets, results) {
    const { log } = results;
    const tars = results.targets;
    const lastTargets = db.lastTargets(pid);
    for (const tar in targets) {
        if (tar in tars) {
            if (tars[tar] == Result.OK) {
                const objkey = `${bid}-${tar}`;
                await storage.fPutObject(minioTargetsBucket, objkey, `${projectDir(pid)}/targets/${tar}`);
                await db.addTarget(bid, tar, objkey);
            }
        }
        else {
            const objkey = lastTargets[tar];
            await db.addTarget(bid, tar, objkey);
        }
    }
    const logkey = `${bid}-log`;
    delete results.log;
    await storage.putObject(minioTargetsBucket, logkey, log);
    await db.updateBuild(bid, logkey, results);
}

async function build(bid) {
    const { id: pid, config, version } = await db.getProject(bid);
    await makeProjectDir(pid);
    const versionList = await getVersionList(pid, config.tree, version);
    if (versionList.config < version) {
        versionList.files = await makeSrcDir(pid, config.tree);
        versionList.config = version
    }
    const dbFiles = mapdbFiles(await db.getFiles(pid));
    let depg = createDepGrapgh(config.targets, versionList, dbFiles);
    const results = await makeAll(pid, depg, dbFiles, config.targets, versionList);
    await updateVersionList(pid, versionList);
    await uploadResults(pid, bid, config.targets, results);
    // notify server
}

export default build;