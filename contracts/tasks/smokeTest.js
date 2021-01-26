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
const { getDeployScripts, getLastDeployScript, getFilesInFolder } = require('../utils/fileSystem');

async function getAllTests() {
	const testsFolder = `${__dirname}/../scripts/test/smokeTest`;
	const testFiles = await getFilesInFolder(testsFolder);
	const tests = [];

	testFiles.forEach(testFile => {
		const test = require(`${testsFolder}/${testFile}`);
		if (!test.beforeDeploy || test.beforeDeploy.length !== 1) {
			throw new Error("Missing beforeDeploy(hre) smoke test function")
		}
		if (!test.afterDeploy || test.afterDeploy.length !== 2) {
			throw new Error("Missing afterDeploy(hre, beforeDeployData) smoke test function")
		}
		test.name = testFile
		tests.push(test)
	})

	return tests
}

async function smokeTest(taskArguments, hre) {
	const deployId = taskArguments.deployid
	let deployScript

	if (deployId) {
		const scripts = await getDeployScripts()
		deployScript = scripts[parseInt(deployId)]
	} else {
		deployScript = await getLastDeployScript()
	}

	const main = require(deployScript.fullPath)

	if (main.length !== 1) {
		throw new Error("Main deploy script function needs to accept Hardhat runtime environment as the first and only parameter in order to be smoke tested.");
	}

	const allTests = await getAllTests();
	const beforeDeployReturns = []

	// execute before deploy step on each of the tests
	for (let i = 0; i < allTests.length; i++) {
		beforeDeployReturns.push(await allTests[i].beforeDeploy(hre))
	}

	// execute contract deployment script
	await main(hre)

	// execute after deploy step on each of the tests
	for (let i = 0; i < allTests.length; i++) {
		const test = allTests[i]
		await test.afterDeploy(hre, beforeDeployReturns[i])
		console.log(`✅ ${test.name} passed!`)
	}
}

module.exports = {
  smokeTest
}