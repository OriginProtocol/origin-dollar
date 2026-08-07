const { deployOnBase } = require("../../utils/deploy-l2");
const { getCreate2ProxyAddress } = require("../deployActions");

module.exports = deployOnBase(
  {
    deployName: "103_oethb_v3_vault_wiring",
    dependencies: ["102_oethb_v3_woeth_v2_upgrade"],
  },
  async ({ ethers }) => {
    const cOETHBaseVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cVault = await ethers.getContractAt(
      "IVault",
      cOETHBaseVaultProxy.address
    );

    const masterProxyAddress = await getCreate2ProxyAddress(
      "OETHbV3MasterProxy"
    );

    return {
      name: "Approve OETHb V3 Master strategy + add to mint whitelist",
      actions: [
        {
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [masterProxyAddress],
        },
        {
          contract: cVault,
          signature: "addStrategyToMintWhitelist(address)",
          args: [masterProxyAddress],
        },
      ],
    };
  }
);
