// Script for verifying against etherscan.
//
// Usage:
//  - Setup your environment
//      export HARDHAT_NETWORK=mainnet
//      export PROVIDER_URL=<url>
//  - Run:
//      node etherscanVerify.js
//
const axios = require("axios");
const { defaultAbiCoder } = require("@ethersproject/abi");
const chalk = require("chalk");
const qs = require("qs");

const hre = require("hardhat");
const flatten = require("truffle-flattener");

const ORIGIN_HEADER = `/*
 * Origin Protocol
 * https://originprotocol.com
 *
 * Released under the MIT license
 * https://github.com/OriginProtocol/origin-dollar
 *
 * Copyright 2020 Origin Protocol, Inc
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
`;

const deprecatedContractNames = [
  "MinuteTimelock",
  "OpenUniswapOracle",
  "RebaseHooks",
  "OUSDReset",
];

function logError(...args) {
  console.log(chalk.red(...args));
}

function getLicenseType(license) {
  const licenseType = (() => {
    if (license === "None") {
      return 1;
    }
    if (license === "UNLICENSED") {
      return 2;
    }
    if (license === "MIT") {
      return 3;
    }
    if (license === "GPL-2.0") {
      return 4;
    }
    if (license === "GPL-3.0") {
      return 5;
    }
    if (license === "LGPL-2.1") {
      return 6;
    }
    if (license === "LGPL-3.0") {
      return 7;
    }
    if (license === "BSD-2-Clause") {
      return 8;
    }
    if (license === "BSD-3-Clause") {
      return 9;
    }
    if (license === "MPL-2.0") {
      return 10;
    }
    if (license === "OSL-3.0") {
      return 11;
    }
    if (license === "Apache-2.0") {
      return 12;
    }
    if (license === "AGPL-3.0") {
      return 13;
    }
  })();
  return licenseType;
}

async function verifyContract(name, config, deployment) {
  const buidlerConfig = hre.config;
  const etherscanApiKey = buidlerConfig.etherscan.apiKey;
  const address = deployment.address;
  console.log("verifying address:", address);
  const chainId = await hre.getChainId();
  let host;
  switch (chainId) {
    case "1":
      host = "https://api.etherscan.io";
      break;
    case "3":
      host = "https://api-ropsten.etherscan.io";
      break;
    case "4":
      host = "https://api-rinkeby.etherscan.io";
      break;
    case "5":
      host = "https://api-goerli.etherscan.io";
      break;
    case "42":
      host = "https://api-kovan.etherscan.io";
      break;
    default:
      return logError(`Network with chainId: ${chainId} not supported`);
  }

  if (!deployment) {
    logError("cannot find deployment of ", name);
  }
  const metadata = JSON.parse(deployment.metadata);

  const compilationTarget = metadata.settings.compilationTarget;
  const contractFilepath = Object.keys(compilationTarget)[0];
  const contractName = compilationTarget[contractFilepath];

  console.log("Target Name:", contractName);

  let constructorArguements = "";
  if (deployment.args) {
    const constructor = deployment.abi.find((v) => v.type === "constructor");
    if (constructor) {
      constructorArguements = defaultAbiCoder
        .encode(constructor.inputs, deployment.args)
        .slice(2);
    }
  } else {
    logError(`no args found, assuming empty constructor...`);
  }

  const contractNamePath = `${contractFilepath}:${contractName}`;

  // apparently I need to change the directly for the path systems to work
  const wd = process.cwd();
  process.chdir(buidlerConfig.paths.root);
  // this should generate a flatten out file for us
  const sourceString = ORIGIN_HEADER + (await flatten([contractFilepath]));
  process.chdir(wd);

  const optimizer = metadata.settings.optimizer;
  const licenseType = getLicenseType(config.license);
  let version = metadata.compiler.version;
  if (version.slice(-4) == ".mod") {
    version = version.slice(0, -4);
  }
  const postData = {
    apikey: etherscanApiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: sourceString,
    codeformat: "solidity-single-file",
    contractname: contractName,
    compilerversion: `v${version}`, // see http://etherscan.io/solcversions for list of support versions
    optimizationUsed: optimizer.enabled ? "1" : "0",
    runs: optimizer.runs,
    constructorArguements,
    licenseType,
  };
  //console.log("postData:", postData);

  const submissionResponse = await axios.request({
    url: `${host}/api`,
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: qs.stringify(postData),
  });
  const { data: submissionData } = submissionResponse;

  let guid;
  if (submissionData.status === "1") {
    guid = submissionData.result;
  } else {
    console.log(submissionData);
    logError(
      `contract ${name} failed to submit : "${submissionData.message}"`,
      submissionData
    );
    return;
  }
  if (!guid) {
    logError(`contract submission for ${name} failed to return a guid`);
    return;
  }

  async function checkStatus() {
    const statusResponse = await axios.get(
      `${host}/api?apikey=${etherscanApiKey}`,
      {
        params: {
          guid,
          module: "contract",
          action: "checkverifystatus",
        },
      }
    );
    const { data: statusData } = statusResponse;
    if (statusData.status === "1") {
      return "success";
    }
    if (statusData.result === "Pending in queue") {
      return undefined;
    }
    logError(
      `Failed to verify contract ${name}: ${statusData.message}, ${statusData.result}`
    );

    logError(
      JSON.stringify(
        {
          apikey: "XXXXXX",
          module: "contract",
          action: "verifysourcecode",
          contractaddress: address,
          sourceCode: "...",
          codeformat: "solidity-single-file",
          contractname: contractName,
          compilerversion: `v${version}`, // see http://etherscan.io/solcversions for list of support versions
          optimizationUsed: optimizer.enabled ? "1" : "0",
          runs: optimizer.runs,
          constructorArguements,
          licenseType,
        },
        null,
        "  "
      )
    );
    return "failure";
  }

  console.log("waiting for result...");
  let result;
  while (!result) {
    await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
    result = await checkStatus();
  }

  if (result === "success") {
    console.log(` => contract ${name} is now verified`);
  }

  if (result === "failure") {
    logError("Etherscan could not verify contract");
  }
}

// Util to parse command line args.
function parseArgv() {
  const args = { params: [] };
  for (const arg of process.argv.slice(2)) {
    if (arg.includes("=")) {
      const elems = arg.split("=");
      const key = elems[0];
      const val = elems.length > 1 ? elems[1] : true;
      args[key] = val;
    } else {
      args.params.push(arg);
    }
  }
  return args;
}

async function main(config) {
  const deployments = await hre.deployments.all();

  console.log(config);
  if (config.params.length == 0) {
    for (const name of Object.keys(deployments)) {
      if (name.startsWith("Mock") || deprecatedContractNames.includes(name)) {
        // We can skip all mocks and the now deprecated MinuteLock and OpenUniswapOracle.
        continue;
      }
      await verifyContract(name, config, deployments[name]);
    }
  } else if (config.params.length == 1) {
    const name = config.params[0];
    if (!deployments[name]) {
      console.log(`Cannot find ${name} in deployments`);
      return;
    }
    await verifyContract(name, config, deployments[name]);
  } else {
    console.log(`Usage: node etherscanVerify.js <optionalContractName>`);
  }
}

// Parse config.
const args = parseArgv();
const config = {
  license: args["--license"] || "MIT", //default to MIT
  params: args.params,
};

// Run the job.
main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
