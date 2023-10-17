const mocha = require("mocha");

const _chunkId = Number(process.env.CHUNK_ID);
const _maxChunks = Number(process.env.MAX_CHUNKS);

const currentBatchTestCases = [];

mocha.beforeEach(function () {
  if (!_maxChunks) {
    // Not parallel tests
    return;
  }

  if (!currentBatchTestCases.includes(
    this.currentTest?.id
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

  const findAllTestCaseIds = (suite) => {
    if (!suite.suites?.length) {
      return suite.tests.map(t => t.id)
    }

    return suite.suites.reduce((ids, currSuite) => {
      return [...ids, ...findAllTestCaseIds(currSuite)]
    }, suite.tests.map(t => t.id))
  }

  const flattenedTestCases = root.suites.reduce((all, currSuite) => {
    return [
      ...all,
      currSuite.tests.map(t => t.id), // Current suite tests
      ...currSuite.suites?.map(nestedSuite => findAllTestCaseIds(nestedSuite)) // Nested suite tests
    ]
  }, []).filter(x => x.length)

  const batchWeights = new Array(_maxChunks).fill(0)
  for (let testCases of flattenedTestCases) {
    const targetBatchIndex = Object.keys(batchWeights).slice(1).reduce((lastIndex, currIndex) => {
      return (batchWeights[lastIndex] == 0 || batchWeights[lastIndex] < batchWeights[currIndex]) ? lastIndex : currIndex
    }, 0)

    batchWeights[targetBatchIndex] += testCases.length
    if (targetBatchIndex == _chunkId) {
      currentBatchTestCases.push(...testCases)
    }
  }
})
