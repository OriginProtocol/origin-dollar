const hre = require("hardhat");
const main = require("../deploy/001_core.js");
const { id, tags } = main;
const { deployOracles, deployOETHCore } = main.functions;

const mainExport = async () => {
	console.log("Running 001_core deployment on Holesky...");
  	await deployOracles();
  	await deployOETHCore();

  	console.log("001_core deploy done.");
  	return true;
};

mainExport.id = id;
mainExport.tags = tags;
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;