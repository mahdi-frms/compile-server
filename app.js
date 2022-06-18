import express from 'express'
import { } from 'dotenv/config'

const app = express();

const { VERSION, PORT } = process.env

app.get('/api/version', (req, res) => {
    res.json({ version: VERSION })
})

app.listen(PORT, () => {
    console.log(`server listening on port ${PORT}`)
});