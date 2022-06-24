import { } from 'dotenv/config'
import express from 'express'
import build from './build.js'

const app = express();

const { VERSION, PORT } = process.env

app.get('/api/version', (req, res) => {
    res.json({ version: VERSION })
});

app.post('/api/build/:bid', (req, res) => {
    build(req.params.bid)
    res.end()
});

app.listen(PORT, () => {
    console.log(`server listening on port ${PORT}`)
});