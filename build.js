import { promises } from 'fs'
import db from './db.js'
const fs = promises

const root = process.argv[2]

function projectDir(pid) {
    return `${root}/projects/${pid}`
}

async function makeProjectDir(pid) {
    const projdir = projectDir(pid);
    await fs.mkdir(`${projdir}/objects/`, { recursive: true });
    await fs.mkdir(`${projdir}/targets/`, { recursive: true });
}

async function makeTree(tree, path, map) {
    if (tree instanceof Number) {
        map.set(tree, path)
    }
    else {
        await fs.mkdir(path);
        for (const ch of tree)
            await makeTree(tree[ch], `${path}/${ch}`);
    }
}

async function makeSrcDir(pid, tree) {
    const srcDir = `${projectDir(pid)}/src/`;
    if (await fs.stat(srcDir).isFile()) {
        await fs.rm(srcDir, { recursive: true, force: true });
    }
    let map = new Map();
    await fs.mkdir(srcDir);
    await makeTree(tree, srcDir, map)
    return map
}

async function getVersionList(config, version) {
    const versionFile = `${projectDir(pid)}/version.json`;
    let versionList;
    if (!await fs.stat(versionFile).isFile()) {
        versionList = { config: 0, files: {} };
    }
    else {
        versionList = JSON.parse(await fs.readFile(versionFile));
    }
    if (versionList.config < version) {
        versionList.files = {}
        const map = await makeSrcDir(pid, config.tree);
        for (const entry of map)
            versionList.files[entry[0]] = { version: 0, path: entry[1] };
    }
}

async function build(bid) {
    const { config, pid, version } = await db.getProject(bid);
    await makeProjectDir(pid);
    const versionList = await getVersionList(config, version);
    // load all file entries from db
    // update newer files

    // create project dependency graph
    // compile every source file and store log
    // link every target after all of it's dependencies are linked
    // upload target files
    // upload log file
    // update build entry
    // notify server
}

export default build;