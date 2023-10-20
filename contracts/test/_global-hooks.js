const mocha = require("mocha");

const { isForkTest } = require("./helpers");

const _chunkId = Number(process.env.CHUNK_ID);
const _maxChunks = Number(process.env.MAX_CHUNKS);

// MAX_CHUNKS is only set on CI for fork-tests 
// when running tests parallely
const runForkTestsParallely = Boolean(_maxChunks);

/**
 * Recursively find the number of test cases the suite
 * has (including the count from nested suites).
 * 
 * @param {mocha.Suite} suite 
 * @returns {Number} Total number of test cases the suite has
 */
const _findAllTestCaseCount = (suite) => {
  if (!suite.suites?.length) {
    return suite.tests?.length || 0;
  }
  return suite.suites.reduce((count, currSuite) => {
    return count + _findAllTestCaseCount(currSuite);
  }, suite.tests?.length || 0);
};

mocha.before(function () {
  // Find the root test suite
  let root = this.runnable().parent;
  while (root.parent) {
    root = root.parent;
  }

  if (!runForkTestsParallely) {
    // When running serially
    if (!isForkTest) {
      // If you are running unit tests,
      // Scrape out all fork tests
      root.suites = root.suites.filter(s => !s.file.endsWith('.fork-test.js'))
    }
    return;
  }

  // In case of parallel tests...
  const currentBatchTestCases = [];

  // Flatten suites up to level 1
  const flattenedSuites = root.suites
    .reduce((all, currSuite) => {
      const nestedSuites = [...currSuite.suites].map((s) => {
        // Make sure the titles are clear for flattened suites
        s.title = s.fullTitle();
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

  // Do a weighted split of test cases across runners
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

    batchWeights[targetBatchIndex] += _findAllTestCaseCount(suite);
    if (targetBatchIndex == _chunkId) {
      currentBatchTestCases.push(suite);
    }
  }

  // Only run the tests that are supposed to be run on the current runner
  root.suites = currentBatchTestCases;
});
