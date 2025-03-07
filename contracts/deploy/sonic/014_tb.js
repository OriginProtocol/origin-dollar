const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "014_tb",
  },
  async ({ ethers }) => {
    const cOSonic = await ethers.getContractAt(
      "OSonic",
      addresses.sonic.OSonicProxy
    );

    return {
      "name": "Delegate yield from some SwapX pools",
      actions: [
        {
          // Undelegate yield from SwapX Moon/OS 
          contract: cOSonic,
          signature: "undelegateYield(address)",
          args: ["0x51caf8b6d184e46aeb606472258242aacee3e23b"],
        },
        {
          // Delegate yield from Metropolis Moon/OS to treasury
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: ["0xc0aac9bb9fb72a77e3bc8bee46d3e227c84a54c0", "0xa9d3b1408353d05064d47daf0dc98e104eb9c98a"],
        },
        {
          // Delegate yield from SwapX GHOG/OS to treasury
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: ["0xd1cb1622a50506f0fddf329cb857a0935c7fbbf9", "0x0a156Fe00DE8A9fbFaa10AbB6Eac864D7374Fba5"],
        },
        {
          // Delegate yield from SwapX OS/HOG to treasury
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: ["0x784dd93f3c42dcbf88d45e6ad6d3cc20da169a60", "0xefb4da71d2fc85ceced7ad15f71e723ccd25f998"],
        },
      ],
    };
  }
);
