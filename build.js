import { promises } from 'fs'
import db from './db.js'
const fs = promises

const root = process.argv[2]

function projectDir(pid) {
    return `${root}/projects/${pid}`
}

async function makeProjectDir(pid) {
    const projdir = projectDir(pid);
    await fs.mkdir(`${projdir}/src`, { recursive: true });
    await fs.mkdir(`${projdir}/objects`, { recursive: true });
    await fs.mkdir(`${projdir}/targets`, { recursive: true });
}

async function build(bid) {
    const { config, pid } = await db.getProject(bid);
    await makeProjectDir(pid);
    // make source tree
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