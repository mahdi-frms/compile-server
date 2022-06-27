import got from 'got'

async function notify(pid) {
    const server = process.env.SERVER;
    const URL = `http://${server}/api/project/${pid}/notify`;
    await got.post(URL, {
        headers: {
            Cookie: `rcs-secret=${process.env.RCS_SECRET}`
        }
    });
}

export default notify;