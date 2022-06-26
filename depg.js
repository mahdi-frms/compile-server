const Status = {
    Ready: 5,
    Intact: 4,
    Depfailed: 3,
    Failed: 2,
    Resolved: 1,
    Wait: 0
};

const Final = {
    Not: 0,
    Final: 1,
    FinalDep: 2,
};

function Depg() {

    this.nodes = {};

    this.add = (n, final) => {
        if (!this.nodes[n])
            this.nodes[n] = {
                status: Status.Ready,
                deps: [],
                final: final ? Final.Final : Final.Not
            };
    }
    this.dep = (n1, n2) => {
        if (!this.nodes[n1] || !this.nodes[n2])
            throw 'nodes must exist';
        if (!this.nodes[n1].deps.includes(n2)) {
            this.nodes[n1].deps.push(n2);
            this.nodes[n1].status = Status.Wait;
            if (this.nodes[n1].final != Final.Not && this.nodes[n2].final == Final.Not)
                this.final(n2);
        }
    }
    this.final = (n) => {
        let node = this.nodes[n];
        if (node.final == Final.Not) {
            node.final = Final.FinalDep;
            for (const d of node.deps) {
                this.final(d);
            }
        }
    }
    this.ready = () => {
        let r = [];
        for (const n in this.nodes)
            if (this.nodes[n].status == Status.Ready)
                r.push(n);
        return r;
    }
    this.checkDeps = (n) => {
        for (const o in this.nodes) {
            if (this.nodes[o].deps.includes(n))
                this.check(o);
        }
    }
    this.check = (n) => {
        let node = this.nodes[n];
        if (node.status != Status.Wait)
            return;
        let intact = 0;
        let status = Status.ready;
        for (const d of node.deps) {
            const dep = node.deps[d];
            if (dep.status == Status.Failed || dep.status == Status.Depfailed) {
                status = Status.Depfailed;
                break;
            }
            else if (dep.status == Status.Intact) {
                intact++;
            }
            else if (dep.status == Status.Wait || dep.status == Status.Ready) {
                status = Status.Wait;
            }
        }
        if (node.deps.length > 0 && node.deps.length == intact) {
            node.status = Status.Intact;
            this.checkDeps(n);
        }
        else if (status != node.status) {
            node.status = status;
            this.checkDeps(n);
        }
    }
    this.resolve = (n) => {
        let node = this.nodes[n];
        if (!node)
            throw 'node must exist';
        if (node.status != Status.Ready)
            throw 'node must be ready';
        node.status = Status.Resolved;
        this.checkDeps(n);
    }
    this.intact = (n) => {
        let node = this.nodes[n];
        if (!node)
            throw 'node must exist';
        if (node.deps.length == 0)
            throw 'node must be independent';
        node.status = Status.Intact;
        this.checkDeps(n);
    }
    this.fail = (n) => {
        let node = this.nodes[n];
        if (!node)
            throw 'node must exist';
        if (node.status != Status.Ready)
            throw 'node must be ready';
        node.status = Status.Failed;
        this.checkDeps(n);
    }
}

export default Depg;