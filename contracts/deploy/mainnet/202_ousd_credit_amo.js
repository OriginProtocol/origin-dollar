const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

// Deploys the OUSD Credit Market AMO strategy implementation, initializes its proxy and
// registers it with the OUSD Vault.
//
// Gated with `forceSkip: true` until the gated Morpho V2 credit vault exists on-chain.
// To activate:
//   1. Run deploy 201 to get the OUSDCreditMarketAMOStrategyProxy address.
//   2. Create the gated credit vault (asset() == OUSD, sole depositor == that proxy) and
//      set addresses.mainnet.OUSDCreditMarketVault to its address.
//   3. Set forceSkip to false, add the governance proposalId, and size the mint cap via a
//      follow-up setMintCap call (the cap starts at 0, so minting stays off until then).
module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "202_ousd_credit_amo",
    forceDeploy: false,
    forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation, ethers, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);
    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    const cProxy = await ethers.getContract("OUSDCreditMarketAMOStrategyProxy");

    console.log("Deploy CreditMarketAMOStrategy implementation");
    const dImpl = await deployWithConfirmation("CreditMarketAMOStrategy", [
      // _baseConfig: platformAddress = credit vault, vaultAddress = OUSD Vault
      [addresses.mainnet.OUSDCreditMarketVault, cVaultProxy.address],
      cOUSDProxy.address, // oToken (OUSD)
      addresses.mainnet.USDC, // hardAsset
    ]);
    const cImpl = await ethers.getContractAt(
      "CreditMarketAMOStrategy",
      dImpl.address
    );
    const cStrategy = await ethers.getContractAt(
      "CreditMarketAMOStrategy",
      cProxy.address
    );

    const initData = cImpl.interface.encodeFunctionData("initialize()", []);

    console.log("Initialize OUSDCreditMarketAMOStrategyProxy");
    await withConfirmation(
      cProxy.connect(sDeployer)[
        // eslint-disable-next-line no-unexpected-multiline
        "initialize(address,address,bytes)"
      ](
        dImpl.address,
        addresses.mainnet.Timelock, // governor
        initData
      )
    );

    return {
      name: "Deploy the OUSD Credit Market AMO Strategy and register it with the OUSD Vault",
      actions: [
        {
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cProxy.address],
        },
        {
          contract: cVault,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cProxy.address],
        },
        {
          contract: cStrategy,
          signature: "safeApproveAllTokens()",
          args: [],
        },
      ],
    };
  }
);
