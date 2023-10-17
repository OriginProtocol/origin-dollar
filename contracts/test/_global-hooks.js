const mocha = require("mocha");

const _chunkId = Number(process.env.CHUNK_ID)
const _maxChunks = Number(process.env.MAX_CHUNKS)

console.log({
  _chunkId,
  _maxChunks
})

let testCounter = 0;
mocha.beforeEach(function () {
  if (!_maxChunks) {
    // Not parallel tests
    return
  }

  testCounter++
  if (testCounter % _maxChunks != _chunkId) {
    this.currentTest.skip()
  }
})
