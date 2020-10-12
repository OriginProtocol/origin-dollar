const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnet,
  isRinkeby,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const { getTxOpts } = require("../utils/tx");

let totalDeployGasUsed = 0;
const isTestMainnet = process.env.TEST_MAINNET_ORACLE;

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

function log(msg, deployResult = null) {
  if (isMainnet || isRinkeby || process.env.VERBOSE) {
    if (deployResult) {
      const gasUsed = Number(deployResult.receipt.gasUsed.toString());
      totalDeployGasUsed += gasUsed;
      msg += ` Address: ${deployResult.address} Gas Used: ${gasUsed}`;
    }
    console.log("INFO:", msg);
  }
}

const newMixOracle = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployerAddr } = await getNamedAccounts();
  const oracleAddresses = await getOracleAddresses(deployments);
  const assetAddresses = await getAssetAddresses(deployments);

  console.log("Running 11_new_mix_oracle deployment...");

  const sDeployer = ethers.provider.getSigner(deployerAddr);

  // Deploy the new MixOracle.
  // Note: the args to the MixOracle are as follow:
  //  - for live the bounds are 1.3 - 0.7
  //  - fot testing the bounds are 1.6 - 0.5
  const MaxMinDrift = isMainnetOrRinkebyOrFork ? [13e7, 7e7] : [16e7, 5e7];
  let d = await deploy("MixOracle", {
    from: deployerAddr,
    args: MaxMinDrift,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    d.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed MixOracle", d);
  const mixOracle = await ethers.getContract("MixOracle");

  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");

  //
  // Deploy the new OpenUniswap oracle and register pairs for it.
  //
  d = await deploy("OpenUniswapOracle", {
    from: deployerAddr,
    args: [oracleAddresses.openOracle, assetAddresses.WETH], // REMEMBER to update the oracle address
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    d.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed OpenUniswapOracle", d);
  const uniswapOracle = await ethers.getContract("OpenUniswapOracle");

  let t = await uniswapOracle
    .connect(sDeployer)
    .registerPair(oracleAddresses.uniswap.DAI_ETH, await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Registered uniswap pair DAI/ETH");

  t = await uniswapOracle
    .connect(sDeployer)
    .registerPair(oracleAddresses.uniswap.USDC_ETH, await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Registered uniswap pair USDC/ETH");

  t = await uniswapOracle
    .connect(sDeployer)
    .registerPair(oracleAddresses.uniswap.USDT_ETH, await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Registered uniswap pair USDT/ETH");

  //
  // ETH -> USD oracles
  //
  t = await mixOracle
    .connect(sDeployer)
    .registerEthUsdOracle(uniswapOracle.address, await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Registered uniswap ETH/USD oracle with MixOracle");

  t = await mixOracle
    .connect(sDeployer)
    .registerEthUsdOracle(chainlinkOracle.address, await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Registered chainlink ETH/USD oracle with MixOracle");

  //
  // Tokens -> ETH oracles
  //
  t = await mixOracle
    .connect(sDeployer)
    .registerTokenOracles(
      "USDC",
      [uniswapOracle.address, chainlinkOracle.address],
      [oracleAddresses.openOracle],
      await getTxOpts()
    );
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Registered USDC token oracles with MixOracle");

  t = await mixOracle
    .connect(sDeployer)
    .registerTokenOracles(
      "USDT",
      [uniswapOracle.address, chainlinkOracle.address],
      [oracleAddresses.openOracle],
      await getTxOpts()
    );
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Registered USDT token oracles with MixOracle");

  t = await mixOracle
    .connect(sDeployer)
    .registerTokenOracles(
      "DAI",
      [uniswapOracle.address, chainlinkOracle.address],
      [oracleAddresses.openOracle],
      await getTxOpts()
    );
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Registered DAI token oracles with MixOracle");

  const cMinuteTimelock = await ethers.getContract("MinuteTimelock");

  // Governor was set to the deployer address during the deployment of the oracles.
  // Update it to the governor address.
  t = await mixOracle
    .connect(sDeployer)
    .transferGovernance(cMinuteTimelock.address, await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("MixOracle transferGovernance called");

  t = await uniswapOracle
    .connect(sDeployer)
    .transferGovernance(cMinuteTimelock.address, await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("UniswapOracle transferGovernance called");

  console.log(
    "11_new_mix_oracle deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

newMixOracle.dependencies = ["core"];
newMixOracle.skip = () => !(isMainnet || isRinkeby || isTestMainnet);

module.exports = newMixOracle;
