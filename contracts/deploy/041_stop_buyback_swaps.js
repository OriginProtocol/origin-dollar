const hre = require("hardhat");

const addresses = require("../utils/addresses");
const { deploymentWithProposal } = require("../utils/deploy");
module.exports = deploymentWithProposal(
  { deployName: "041_stop_buyback_swaps", forceDeploy: false },
  async ({}) => {
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
        },
      ],
    };
  }
);
