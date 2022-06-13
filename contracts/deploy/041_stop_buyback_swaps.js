const hre = require("hardhat");

const addresses = require("../utils/addresses");
const { log, deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "041_stop_buyback_swaps", forceDeploy: false },
  async ({
    oracleAddresses,
    assetAddresses,
    ethers,
    deployWithConfirmation,
    withConfirmation,
  }) => {
    const { deployerAddr } = await hre.getNamedAccounts();

    // Buyback contract
    const cBuyback = await ethers.getContract("Buyback");

    // Governance proposal
    return {
      name: "Deploy all new contracts and migrate all funds",
      actions: [
        {
          // Collect old OGN
          contract: cBuyback,
          signature: "setUniswapAddr(address)",
          args: [addresses.zero],
        }
      ],
    };
  }
);
