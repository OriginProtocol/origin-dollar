const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "020_tb",
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
          // Protocol: Peapods finance
          // From: pOS --> To: GnosisSafe Peapods treasury
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            "0x09C0753B291aEaAdcEEe59199Fd34F915EB34c2e",
            "0x7E13b447e88523eB855f1a4131D2e089485dA6Cf",
          ],
        },
        {
          // Plateform: SwapX
          // Protocol: Yel Finance
          // From: YEL/OS --> To: GnosisSafe YEL treasury
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            "0x03cdd1327d71060c7c77de2728176a10a2a5aa33",
            "0x1397E736bA239BB51E971793F6e18136327fBCc8",
          ],
        },
      ],
    };
  }
);
