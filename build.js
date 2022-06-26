import { promises, createWriteStream } from 'fs'
import db from './db.js'
import storage from './storage.js'
import Compool from './compool.js'
import Depg from './depg.js'

const fs = promises

const root = process.argv[2]
const minioFilesBucket = 'projsrc'

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
    console.log(objkey, '->', path);
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

async function updateSrcTree(pid, versionList) {
    let updateList = []

    const dbfiles = await db.getFiles(pid);
    for (const fid in versionList.files) {
        let file = versionList.files[fid];
        const dbentry = dbfiles.find(f => { return f.id == Number(fid) });
        if (!dbentry)
            return false;
        if (dbentry.version > file.version) {
            updateList.push(updateFile(dbentry.key, file.path));
            file.version = dbentry.version;
        }
    }
    await fs.writeFile(`${projectDir(pid)}/version.json`, JSON.stringify(versionList));
    try {
        await Promise.all(updateList);
        return true;
    }
    catch (err) {
        return false;
    }
}

async function compileSrcTree(pid, versionList) {
    let fids = [];
    let buildTasks = [];
    for (const fid in versionList.files) {
        const { path } = versionList.files[fid];
        buildTasks.push(compool.compile(path, `${projectDir(pid)}/objects/${fid}.o`));
        fids.push(fid)
    }
    const results = await Promise.all(buildTasks);
    let log = '';
    let success = true;
    for (let i = 0; i < buildTasks.length; i++) {
        const path = versionList.files[fids[i]];
        const rsl = results[i];
        log += `----> ${path}\n\n${rsl.log}\n\n`;
        success &= rsl.status == 0;
    }
    return { log, success }
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

    console.log(depg)

    // link every target after all of it's dependencies are linked
    // upload target files
    // upload log file
    // update build entry
    // notify server
}

export default build;