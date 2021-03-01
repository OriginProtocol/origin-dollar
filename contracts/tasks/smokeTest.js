/**
 * Execute smoke tests on the mainnet:fork network.
 *
 * This script reads all of the tests present in the `contracts/scripts/test/smokeTest` folder. Each
 * file should contain one tests and export these functions:
 *  - beforeDeploy (hre) -> function executes before contract deployment and can return validation data
 *  - afterDeploy (hre, beforeDeployData) -> function executes after contract deployment and as a second
 *    param receives return value of `beforeDeploy` function. `beforeDeployData` can be used to validate
 *    that the state change is ok
 */
const {
  getDeployScripts,
  getLastDeployScript,
  getFilesInFolder,
} = require("../utils/fileSystem");
const readline = require("readline");
readline.emitKeypressEvents(process.stdin);

let lastKeyPressedRegister = null;
process.stdin.on("keypress", (str, key) => {
  lastKeyPressedRegister = key;

  if (key.ctrl && key.name === "c") {
    process.exit();
  }
});

async function getAllTests() {
  const testsFolder = `${__dirname}/../smoke`;
  const testFiles = await getFilesInFolder(testsFolder);
  const tests = [];

  testFiles.forEach((testFile) => {
    const test = require(`${testsFolder}/${testFile}`);
    if (!test.beforeDeploy || test.beforeDeploy.length !== 1) {
      throw new Error("Missing beforeDeploy(hre) smoke test function");
    }
    if (!test.afterDeploy || test.afterDeploy.length !== 2) {
      throw new Error(
        "Missing afterDeploy(hre, beforeDeployData) smoke test function"
      );
    }
    test.name = testFile;
    tests.push(test);
  });

  return tests;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function smokeTestCheck(taskArguments, hre) {
  const deployId = taskArguments.deployid;

  if (!deployId) {
    // interactive mode nothing to do here
    return;
  }

  const scripts = await getDeployScripts();
  const deployScript = scripts[parseInt(deployId)];
  const main = require(deployScript.fullPath);

  if (!main.skip()) {
    throw new Error(
      "Deploy script that smoke tests are ran against should return skip === true in smoke test environment. See that the 'main.skip' function in deploy script ends with '|| isSmokeTest;'"
    );
  }
}

async function smokeTest(taskArguments, hre) {
  const deployId = taskArguments.deployid;
  let interactiveMode = false;
  let deployScript;
  let main;

  if (deployId) {
    const scripts = await getDeployScripts();
    deployScript = scripts[parseInt(deployId)];
  } else {
    /* Start up interactive mode where process waits for the user to execute commands in the hardhat
     * console and then by pressing `Enter` confirms that the smoke tests can proceed.
     */
    interactiveMode = true;
  }

  const waitForInteractiveModeInput = async (message) => {
    if (!interactiveMode) {
      return;
    }

    console.log(message);
    while (!lastKeyPressedRegister || lastKeyPressedRegister.name !== "enter") {
      await sleep(100);
    }
  };

  if (!interactiveMode) {
    main = require(deployScript.fullPath);

    if (main.length !== 1) {
      throw new Error(
        "Main deploy script function needs to accept Hardhat runtime environment as the first and only parameter in order to be smoke tested."
      );
    }
  }

  const allTests = await getAllTests();
  const beforeDeployReturns = [];

  // execute before deploy step on each of the tests
  for (let i = 0; i < allTests.length; i++) {
    beforeDeployReturns.push(await allTests[i].beforeDeploy(hre));
  }

  if (!interactiveMode) {
    // execute contract deployment script
    await main(hre);
  } else {
    await waitForInteractiveModeInput(
      'All before parts of the tests executed. Use "FORK=true npx hardhat console --network localhost" to connect console to the node. Press enter for tests to continue.'
    );
  }

  // execute after deploy step on each of the tests
  for (let i = 0; i < allTests.length; i++) {
    const test = allTests[i];
    await test.afterDeploy(hre, beforeDeployReturns[i]);
    console.log(`✅ ${test.name} passed!`);
  }
}

module.exports = {
  smokeTest,
  smokeTestCheck,
};
