const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");
const addresses = require("../utils/addresses");
const { getTxOpts } = require("../utils/tx");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "070_flux_strategy",
    forceDeploy: false,
    // forceSkip: true,
    deployerIsProposer: true,
    proposalId:
      "91660566454734065741871109032962399777954404025908021614421255240824728026045",
  },
  async ({ ethers }) => {
    const { deployerAddr, timelockAddr } = await getNamedAccounts();

    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cVaultProxy = await ethers.getContractAt(
      "IVault",
      addresses.mainnet.VaultProxy
    );
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      addresses.mainnet.VaultProxy
    );

    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    const dFluxStrategyProxy = await deployWithConfirmation(
      "FluxStrategyProxy"
    );
    const cFluxStrategyProxy = await ethers.getContract("FluxStrategyProxy");

    const dFluxStrategy = await deployWithConfirmation(
      "FluxStrategy",
      [
        {
          platformAddress: addresses.dead,
          vaultAddress: cVaultProxy.address,
        },
      ],
      null,
      // Skipping storage checks since the CompoundStrategy contract has changed
      true
    );
    const cFluxStrategyImpl = await ethers.getContractAt(
      "FluxStrategy",
      dFluxStrategy.address
    );

    const cFluxStrategy = await ethers.getContractAt(
      "FluxStrategy",
      dFluxStrategyProxy.address
    );

    // Construct initialize call data to init and configure the new strategy
    const initData = cFluxStrategyImpl.interface.encodeFunctionData(
      "initialize(address[],address[],address[])",
      [
        [], // reward token addresses
        [addresses.mainnet.DAI, addresses.mainnet.USDC, addresses.mainnet.USDT],
        [
          addresses.mainnet.fDAI,
          addresses.mainnet.fUSDC,
          addresses.mainnet.fUSDT,
        ],
      ]
    );

    // prettier-ignore
    await withConfirmation(
      cFluxStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dFluxStrategy.address,
          timelockAddr,
          initData,
          await getTxOpts()
        )
    );
    console.log("Initialized FluxStrategy");

    // Governance Actions
    // ----------------
    return {
      name: "Add Flux Strategy",
      actions: [
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cFluxStrategyProxy.address],
        },
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cFluxStrategyProxy.address, true],
        },
        {
          contract: cFluxStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);
