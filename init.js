import fs from 'fs'
import { exit } from 'process';

function init() {
    if (process.argv.length < 3) {
        console.error('arg required: server root directory');
        exit(1);
    }
    const root = process.argv[2];
    if (!fs.existsSync(root)) {
        fs.mkdirSync(`${root}/projects/`, { recursive: true });
    }
}

export default init;