const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "138_buyback_deprecation",
    forceDeploy: false,
    // forceSkip: true,
    // reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const cLegacyBuyback = await ethers.getContractAt(
      "OUSDBuyback",
      "0x77314eb392b2be47c014cde0706908b3307ad6a9"
    );
    const ogv = await ethers.getContractAt("IERC20", addresses.mainnet.OGV);
    const ogvInLegacyBuyback = await ogv.balanceOf(cLegacyBuyback.address);

    console.log("OGV in Legacy Buyback:", ogvInLegacyBuyback.toString());

    const cOUSDBuybackProxy = await ethers.getContract("BuybackProxy");
    const cOUSDBuyback = await ethers.getContractAt(
      "OUSDBuyback",
      cOUSDBuybackProxy.address
    );
    const cOETHBuybackProxy = await ethers.getContract("OETHBuybackProxy");
    const cOETHBuyback = await ethers.getContractAt(
      "OETHBuyback",
      cOETHBuybackProxy.address
    );
    const cARMBuybackProxy = await ethers.getContract("ARMBuybackProxy");
    const cARMBuyback = await ethers.getContractAt(
      "ARMBuyback",
      cARMBuybackProxy.address
    );

    const cOUSDVaultProxy = await ethers.getContract("VaultProxy");
    const cOUSDVault = await ethers.getContractAt(
      "IVault",
      cOUSDVaultProxy.address
    );
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVault = await ethers.getContractAt(
      "IVault",
      cOETHVaultProxy.address
    );

    return {
      name: `Update fee recipient and change ownership of buyback contracts

- Sets the trustee address to the multichain Guardian for OUSD and OETH vaults
- Changes the governor of existing and legacy buyback contracts to the multichain Guardian to enable updated buyback operations`,
      actions: [
        {
          // Send all OUSD fees to the Multichain Strategist
          contract: cOUSDVault,
          signature: "setTrusteeAddress(address)",
          args: [addresses.multichainStrategist],
        },
        {
          // Send all OETH fees to the Multichain Strategist
          contract: cOETHVault,
          signature: "setTrusteeAddress(address)",
          args: [addresses.multichainStrategist],
        },
        // Transfer governance from all buyback contracts to the Multichain Strategist
        {
          contract: cOUSDBuyback,
          signature: "transferGovernance(address)",
          args: [addresses.multichainStrategist],
        },
        {
          contract: cOETHBuyback,
          signature: "transferGovernance(address)",
          args: [addresses.multichainStrategist],
        },
        {
          contract: cARMBuyback,
          signature: "transferGovernance(address)",
          args: [addresses.multichainStrategist],
        },
        {
          contract: cLegacyBuyback,
          signature: "transferGovernance(address)",
          args: [addresses.multichainStrategist],
        },
      ],
    };
  }
);
