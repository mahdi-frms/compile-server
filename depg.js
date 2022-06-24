function Depg() {
    this.nodes = {}

    this.check = (n) => {
        if (!this.nodes[n])
            this.nodes[n] = [];
    }
    this.dep = (n1, n2) => {
        this.check(n1);
        this.check(n2);
        if (!this.nodes[n1].includes(n2))
            this.nodes[n1].push(n2)
    }
    this.free = () => {
        for (const n in this.nodes)
            if (this.nodes[n].length == 0)
                return n;
        return null;
    }
    this.pop = (n) => {
        if (this.nodes[n]) {
            delete this.nodes[n];
            for (const o in this.nodes) {
                let nl = this.nodes[o]
                if (nl.includes(n)) {
                    nl.splice(nl.indexOf(n), 1);
                }
            }
        }
    }
}

export default Depg;