import got from 'got'

async function notify (pid)
{
    const server = process.env.SERVER;
    const URL = `${server}/api/project/${pid}/notify`;
    await got.post(URL);
}

export default notify;