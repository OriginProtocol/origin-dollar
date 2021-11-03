const { deploymentWithProposal } = require("../utils/deploy");

const OLD_COMP_STRAT = "0xD5433168Ed0B1F7714819646606DB509D9d8EC1f";

module.exports = deploymentWithProposal(
  { deployName: "027_comp_rescue_b", forceDeploy: false },
  async ({ ethers }) => {
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    return {
      name: "Collects COMP from old Contract",
      actions: [
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [OLD_COMP_STRAT],
        },
        {
          contract: cVaultAdmin,
          signature: "harvestAndSwap(address)",
          args: [OLD_COMP_STRAT],
        },
        {
          contract: cVaultAdmin,
          signature: "removeStrategy(address)",
          args: [OLD_COMP_STRAT],
        },
      ],
    };
  }
);
