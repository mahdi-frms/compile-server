async function kmap(prm, key) {
    const r = await prm;
    return { key, result: r };
}

function never() {
    return new Promise((res, rej) => { });
}

function Tasklist() {
    this.tasks = []
    this.map = {}

    this.append = (key, task) => {
        const idx = this.tasks.length;
        this.map[key] = idx;
        this.tasks[idx] = kmap(task, key);
    }

    this.wait = async () => {
        const { result, key } = await Promise.race(this.tasks);
        const idx = this.map[key];
        this.tasks[idx] = never();
        return { result, key };
    }
}

export default Tasklist;