import { spawn } from 'child_process'
import EventEmitter from 'events';

function ewait(emitter, event) {
    return new Promise((res, rej) => {
        emitter.once(event, (value) => {
            res(value);
        })
    });
}

function Semaphore(value) {
    this.token = 0;
    this.queue = [];
    this.value = value;
    this.emitter = new EventEmitter();

    this.wait = async function () {
        if (this.value > 0)
            this.value--;
        else {
            const token = this.token++;
            this.queue.push(token);
            while (true) {
                const value = ewait(this.emitter, 'release');
                if (value == token)
                    break;
            }
        }
    }

    this.signal = function () {
        if (this.queue.length > 0)
            this.emitter.emit('release', this.queue.pop());
        else
            this.value++;
    }
}

async function createChild(bin, args) {
    return new Promise((res, rej) => {
        let log = ''
        let ch = spawn(bin, args);
        ch.stdout.on('data', (data) => { log += data });
        ch.stderr.on('data', (data) => { log += data });
        ch.on('exit', (status) => {
            res({ log, status });
        })
    })
}

function Compool(size) {
    this.semaphore = new Semaphore(size);
    this.compile = async function (src, output) {
        await this.semaphore.wait();
        const rsl = createChild('gcc', ['-c', src, '-o', output]);
        this.semaphore.signal();
        return rsl;
    }
    this.link = async function (objs, deps, output) {
        const ldeps = deps.map((d) => { return `-l${d}`; })
        await this.semaphore.wait();
        const rsl = createChild('gcc', objs.concat(ldeps).concat(['-o', output]));
        this.semaphore.signal();
        return rsl;
    }
}

export default Compool;