const mocha = require("mocha");

const _chunkId = Number(process.env.CHUNK_ID);
const _maxChunks = Number(process.env.MAX_CHUNKS);

mocha.before(function () {
  const currentBatchTestCases = [];

  if (!_maxChunks) {
    // Not parallel tests
    return;
  }

  let root = this.runnable().parent;
  while (root.parent) {
    root = root.parent;
  }

  const findAllTestCaseCount = (suite) => {
    if (!suite.suites?.length) {
      return suite.tests?.length || 0;
    }

    return suite.suites.reduce((count, currSuite) => {
      return count + findAllTestCaseCount(currSuite);
    }, suite.tests?.length || 0);
  };

  const flattenedSuites = root.suites
    .reduce((all, currSuite) => {
      const nestedSuites = [...currSuite.suites].map((s) => {
        s.title = `${currSuite.fullTitle()} > ${s.fullTitle()}`;
        return s;
      });
      currSuite.suites = [];
      return [
        ...all,
        ...nestedSuites, // Nested suites (L1)
        currSuite, // Current suite
      ];
    }, [])
    .filter((x) => x.tests.length);

  const batchWeights = new Array(_maxChunks).fill(0);
  for (let suite of flattenedSuites) {
    const targetBatchIndex = Object.keys(batchWeights)
      .slice(1)
      .reduce((lastIndex, currIndex) => {
        return batchWeights[lastIndex] == 0 ||
          batchWeights[lastIndex] < batchWeights[currIndex]
          ? lastIndex
          : currIndex;
      }, 0);

    batchWeights[targetBatchIndex] += findAllTestCaseCount(suite);
    if (targetBatchIndex == _chunkId) {
      currentBatchTestCases.push(suite);
    }
  }

  root.suites = currentBatchTestCases;
});
