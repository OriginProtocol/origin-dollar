import express from 'express'
import serveStatic from 'serve-static'
import { spawn } from 'child_process'
import opener from 'opener'
import fs from 'fs'

const sslProxy = process.env.SSL_PROXY ? true : false
const HOST = process.env.HOST || 'localhost'
const app = express()

app.get('/:net([a-z]+)?', (req, res) => {
  const config = req.params.net || process.env.NETWORK || 'localhost'
  let html = fs.readFileSync(__dirname + '/public/dev.html').toString()
  html = html.replace(/\{HOST\}/g, `http${sslProxy ? 's' : ''}://${HOST}:8083/`)
  res.send(html)
})

app.use(serveStatic('public'))

async function start() {
  const devServerArgs = ['--info=false', '--port=8083', '--host=0.0.0.0']
  if (sslProxy) {
    devServerArgs.push('--https')
    devServerArgs.push('--key=data/localhost.key')
    devServerArgs.push('--cert=data/localhost.cert')
  }
  const webpackDevServer = spawn(
    './node_modules/.bin/webpack-dev-server',
    devServerArgs,
    {
      stdio: 'inherit',
      env: process.env
    }
  )
  process.on('exit', () => webpackDevServer.kill())

  const PORT = process.env.PORT || 3010
  app.listen(PORT, () => {
    console.log(`\nListening on port ${PORT}\n`)
    if (!process.env.NOOPENER) {
      setTimeout(() => opener(`http://${HOST}:${PORT}`), 2000)
    }
  })
}

start()
