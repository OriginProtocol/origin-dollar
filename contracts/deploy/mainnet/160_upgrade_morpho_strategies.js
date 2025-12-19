const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "160_upgrade_morpho_strategies",
    forceDeploy: false,
    // forceSkip: true,
    // reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId: "",
  },
  async ({ deployWithConfirmation, getTxOpts, withConfirmation }) => {
    // Current OUSD Vault contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    const dMorphoSteakhouseUSDCStrategyProxy = await ethers.getContract(
      "MetaMorphoStrategyProxy"
    );
    const dMorphoGauntletPrimeUSDCStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDCStrategyProxy"
    );
    const dMorphoGauntletPrimeUSDTStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDTStrategyProxy"
    );

    // Deployer Actions
    // ----------------

    // Fix the signer to the deployer of the Morpho OUSD v2 strategy proxy
    const sDeployer = await ethers.provider.getSigner(
      "0x58890A9cB27586E83Cb51d2d26bbE18a1a647245"
    );

    // 1. Deploy new contract for Morpho Steakhouse USDC
    const dMorphoSteakhouseUSDCStrategyImpl = await deployWithConfirmation(
      "Generalized4626Strategy",
      [
        [addresses.mainnet.MorphoSteakhouseUSDCVault, cVaultProxy.address],
        addresses.mainnet.USDC,
      ]
    );

    // 2. Deploy new contract for Morpho Gauntlet Prime USDC
    const dMorphoGauntletPrimeUSDCStrategyImpl = await deployWithConfirmation(
      "Generalized4626Strategy",
      [
        [addresses.mainnet.MorphoGauntletPrimeUSDCVault, cVaultProxy.address],
        addresses.mainnet.USDC,
      ]
    );

    // 3. Deploy new contract for Morpho Gauntlet Prime USDT
    const dMorphoGauntletPrimeUSDTStrategyImpl = await deployWithConfirmation(
      "Generalized4626USDTStrategy",
      [
        [addresses.mainnet.MorphoGauntletPrimeUSDTVault, cVaultProxy.address],
        addresses.mainnet.USDT,
      ]
    );

    // 4. Get previously deployed proxy to Morpho OUSD v2 strategy
    const cOUSDMorphoV2StrategyProxy = await ethers.getContract(
      "OUSDMorphoV2StrategyProxy"
    );

    // 5. Deploy new strategy for the Morpho Yearn OUSD V2 Vault
    const dOUSDMorphoV2StrategyImpl = await deployWithConfirmation(
      "Generalized4626Strategy",
      [
        [addresses.mainnet.MorphoOUSDv2Vault, cVaultProxy.address],
        addresses.mainnet.USDC,
      ]
    );
    const cOUSDMorphoV2Strategy = await ethers.getContractAt(
      "Generalized4626Strategy",
      cOUSDMorphoV2StrategyProxy.address
    );

    // 6. Construct initialize call data to initialize and configure the new strategy
    const initData = cOUSDMorphoV2Strategy.interface.encodeFunctionData(
      "initialize()",
      []
    );

    // 7. Init the proxy to point at the implementation, set the governor, and call initialize
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cOUSDMorphoV2StrategyProxy.connect(sDeployer)[initFunction](
        dOUSDMorphoV2StrategyImpl.address,
        addresses.mainnet.Timelock, // governor
        initData, // data for delegate call to the initialize function on the strategy
        await getTxOpts()
      )
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade Morpho Steakhouse and Gauntlet Prime Strategies to claim MORPHO rewards from Merkl",
      actions: [
        {
          // 1. Upgrade Morpho Steakhouse USDC Strategy
          contract: dMorphoSteakhouseUSDCStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dMorphoSteakhouseUSDCStrategyImpl.address],
        },
        {
          // 2. Upgrade Morpho Gauntlet Prime USDC Strategy
          contract: dMorphoGauntletPrimeUSDCStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dMorphoGauntletPrimeUSDCStrategyImpl.address],
        },
        {
          // 3. Upgrade Morpho Gauntlet Prime USDT Strategy
          contract: dMorphoGauntletPrimeUSDTStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dMorphoGauntletPrimeUSDTStrategyImpl.address],
        },
        {
          // 4. Add the new Morpho OUSD v2 strategy to the vault
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cOUSDMorphoV2Strategy.address],
        },
        {
          // 5. Set the Harvester of the Morpho OUSD v2 strategy to the BuyBack Operator
          contract: cOUSDMorphoV2Strategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.multichainBuybackOperator],
        },
        {
          // 6. Set the Morpho Gauntlet Prime USDC strategy as the default for USDC
          contract: cVaultAdmin,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [
            addresses.mainnet.USDC,
            dMorphoGauntletPrimeUSDCStrategyProxy.address,
          ],
        },
        {
          // 7. Withdraw all from the Morpho Steakhouse strategy
          contract: cVaultAdmin,
          signature: "withdrawAllFromStrategy(address)",
          args: [dMorphoSteakhouseUSDCStrategyProxy.address],
        },
        {
          // 8. Remove the Morpho Steakhouse strategy
          contract: cVaultAdmin,
          signature: "removeStrategy(address)",
          args: [dMorphoSteakhouseUSDCStrategyProxy.address],
        },
        {
          // 9. Deposit 10k to the new Morpho OUSD v2 strategy
          contract: cVaultAdmin,
          signature: "depositToStrategy(address,address[],uint256[])",
          args: [
            cOUSDMorphoV2Strategy.address,
            [addresses.mainnet.USDC],
            ["10000000000"], // 10,000 USDC with 6 decimals
          ],
        },
        {
          // 10. Change the redeem fee from 0.25% to 0.1%
          contract: cVaultAdmin,
          signature: "setRedeemFeeBps(uint256)",
          args: [10],
        },
      ],
    };
  }
);
