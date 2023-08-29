const addresses = require("../utils/addresses");
const { deploymentWithProposal } = require("../utils/deploy");
module.exports = deploymentWithProposal(
  { deployName: "041_stop_buyback_swaps", forceDeploy: false },
  async () => {
    // Buyback contract
    const cBuyback = await ethers.getContract("Buyback");

    // Governance proposal
    return {
      name: "Pause swaps on buyback contract",
      actions: [
        {
          // Set Uniswap address to 0x0
          contract: cBuyback,
          signature: "setUniswapAddr(address)",
          args: [addresses.zero],
        },
      ],
    };
  }
);
