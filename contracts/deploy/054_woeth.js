const { deploymentWithGuardianGovernor } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const hre = require("hardhat");
const { BigNumber, utils } = require("ethers");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnet,
  isFork,
  isMainnetOrFork,
} = require("../test/helpers.js");

// 5/8 multisig
const guardianAddr = addresses.mainnet.Guardian;

module.exports = deploymentWithGuardianGovernor(
  { deployName: "054_woeth" },
  async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const actions = await deployWOETH({
      deployWithConfirmation,
      withConfirmation,
      ethers,
    });

    // Governance Actions
    // ----------------
    return {
      name: "Deploy WOETH Token",
      actions,
    };
  }
);

const deployWOETH = async ({
  deployWithConfirmation,
  withConfirmation,
  ethers,
}) => {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cOETHProxy = await ethers.getContract("OETHProxy");
  const cWOETHProxy = await ethers.getContract("WOETHProxy");

  const dWOETHImpl = await deployWithConfirmation("WOETH", [
    cOETHProxy.address,
    "Wrapped OETH",
    "WOETH",
  ]);

  const cWOETH = await ethers.getContractAt("WOETH", cWOETHProxy.address);

  return [
    {
      contract: cWOETHProxy,
      signature: "upgradeTo(address)",
      args: [dWOETHImpl.address],
    },
    {
      contract: cWOETH,
      signature: "initialize()",
      args: [],
    },
  ];
};
