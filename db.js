import pg from 'pg'

function db() {

    this.pool = new pg.Pool({
        host: process.env.DBHOST,
        database: process.env.DBNAME,
        user: process.env.DBUSER,
        password: process.env.DBPASS,
    });

    this.query = async (queryString, values) => {
        let client = await this.pool.connect();
        try {
            return await client.query(queryString, values);
        }
        finally {
            await client.release();
        }
    }
    this.execute = async (queryString, values) => {
        let client = await this.pool.connect();
        try {
            await client.query(queryString, values);
        }
        finally {
            await client.end();
        }
    }

    this.getProject = async (bid) => {
        let rsl = await this.query(
            `select P.id as id, P.name as name, P.config as config, P.version as version
            from builds as B join projects as P on B.pid = P.id where B.id = $1;`
            , [bid]);
        if (rsl.rowCount == 0)
            return null;
        rsl = rsl.rows[0];
        return {
            id: rsl.id,
            config: rsl.config,
            name: rsl.name,
            version: rsl.version
        };
    }
    this.getFiles = async (pid) => {
        let rsl = await this.query(
            `select F.fid as id, F.version as version, F.objkey as key
            from files as F join projects as P on F.pid=P.id where P.id=$1`
            , [pid]);
        return rsl.rows;
    }
    this.BuildStatus = {
        Failure: -1,
        Success: 1,
        Compiling: 0,
    }
    this.updateBuild = async (bid, logkey, status) => {
        await this.execute(`update builds set status=$1, logkey=$2 where id=$3`
            , [status, logkey, bid]);
    }
    this.addTarget = async (bid, tarname, objkey) => {
        await this.execute(`insert into targets(bid,name,objkey) values ($1,$2,$3)`
            , [bid, tarname, objkey]);
    }
}

let dbObj = new db()

export default dbObj;