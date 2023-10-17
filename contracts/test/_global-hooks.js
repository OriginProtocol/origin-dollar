const mocha = require("mocha");

const _chunkId = Number(process.env.CHUNK_ID);
const _maxChunks = Number(process.env.MAX_CHUNKS);

let _testCaseCounter = 0;
let _batchCounter = 0;
let _batchSize = 5; // Group every 5 case into same batch
mocha.beforeEach(function () {
  if (!_maxChunks) {
    // Not parallel tests
    return;
  }

  _testCaseCounter++;
  _batchCounter = Math.ceil(_testCaseCounter / _batchSize);

  if (_batchCounter % _maxChunks != _chunkId) {
    this.currentTest.skip();
  }
});
