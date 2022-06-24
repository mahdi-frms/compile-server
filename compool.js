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
        let meslog = ''
        let errlog = ''
        let ch = spawn('gcc', ['-c', src, '-o', output]);
        ch.stdout.on('data', (data) => { meslog += data });
        ch.stderr.on('data', (data) => { errlog += data });
        ch.on('exit', (status) => {
            res({ meslog, errlog, status });
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
}