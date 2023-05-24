const {
  deploymentWithGuardianGovernor,
  impersonateAccount,
  sleep,
} = require("../utils/deploy");
const addresses = require("../utils/addresses");
const hre = require("hardhat");
const { BigNumber, utils, Contract } = require("ethers");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnet,
  isFork,
  isMainnetOrFork,
} = require("../test/helpers.js");
const { MAX_UINT256, oethPoolLpPID } = require("../utils/constants");
const crvRewards = "0x24b65DC1cf053A8D96872c323d29e86ec43eB33A";
const gaugeAddress = "0xd03BE91b1932715709e18021734fcB91BB431715";
const poolAddress = "0x94b17476a93b3262d87b9a326965d1e91f9c13e7";
const tokenAddress = "0x94b17476a93b3262d87b9a326965d1e91f9c13e7";

// 5/8 multisig
const guardianAddr = addresses.mainnet.Guardian;

module.exports = deploymentWithGuardianGovernor(
  { deployName: "061_oeth_timelock_part_1" },
  async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    // const { deployerAddr, governorAddr } = await getNamedAccounts();

    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHOracleRouter = await ethers.getContract("OETHOracleRouter");

    // transferGovernance
    
    // Governance Actions
    // ----------------
    return {
      name: "Transfer governance to the Timelock",
      actions,
    };
  }
);
