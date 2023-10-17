const mocha = require("mocha");

const _chunkId = Number(process.env.CHUNK_ID);
const _maxChunks = Number(process.env.MAX_CHUNKS);

const currentBatchTestCases = [];

mocha.beforeEach(function () {
  if (!_maxChunks) {
    // Not parallel tests
    return;
  }

  let root = this.runnable().parent
  while (root.parent) {
    root = root.parent
  }

  if (!currentBatchTestCases.includes(
    `${root.file}||||||${root.fullTitle()}`
  )) {
    this.currentTest?.skip()
  }
});

mocha.before(function () {
  if (!_maxChunks) {
    // Not parallel tests
    return;
  }

  let root = this.runnable().parent
  while (root.parent) {
    root = root.parent
  }

  const findTestCaseCount = (suite) => {
    if (!suite.suites?.length) {
      return suite.tests?.length || 0
    }

    return suite.suites.reduce((count, currSuite) => {
      return count + findTestCaseCount(currSuite)
    }, suite.tests?.length || 0)
  }

  // const batches = new Array(_maxChunks)
  const batchWeights = new Array(_maxChunks).fill(0)

  for (let suite of root.suites) {
    const testCaseCount = findTestCaseCount(suite)

    const targetBatchIndex = Object.keys(batchWeights).slice(1).reduce((lastIndex, currIndex) => {
      return (batchWeights[lastIndex] == 0 || batchWeights[lastIndex] < batchWeights[currIndex]) ? lastIndex : currIndex
    }, 0)

    // if (!batches[targetBatchIndex]) {
    //   batches[targetBatchIndex] = []
    // }
    // batches[targetBatchIndex].push(suite.fullTitle())
    batchWeights[targetBatchIndex] += testCaseCount

    if (targetBatchIndex == _chunkId) {
      currentBatchTestCases.push(`${suite.file}||||||${suite.fullTitle()}`)
    }
  }
})
