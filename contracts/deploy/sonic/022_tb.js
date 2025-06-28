const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "022_tb",
  },
  async ({ ethers }) => {
    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Contracts
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const cOSonic = await ethers.getContractAt(
      "OSonic",
      addresses.sonic.OSonicProxy
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Governance Actions
    // ---
    // ---------------------------------------------------------------------------------------------------------
    return {
      actions: [
        {
          // Plateform: Atlandis
          // From: WS/OS --> To: EOA
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            "0x9776a3f05e9b3aFF2B2f15a4Edf5e1ff53e50ae7",
            "0x0E880a06B59c01Be6837DCa9D4306c6cc0dE8219",
          ],
        },
      ],
    };
  }
);
