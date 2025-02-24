const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "106_ousd_metamorpho_usdc",
    forceDeploy: false,
    // forceSkip: true,
    // reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "18625164866922300754601338202643973145672922743793130890170553774294234651247",
  },
  async ({ deployWithConfirmation, getTxOpts, withConfirmation }) => {
    // Current OUSD Vault contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    // Deployer Actions
    // ----------------
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // 1. Deploy new MetaMorpho Strategy proxy
    const dMetaMorphoProxy = await deployWithConfirmation(
      "MetaMorphoStrategyProxy"
    );
    const cMetaMorphoProxy = await ethers.getContract(
      "MetaMorphoStrategyProxy"
    );

    // 2. Deploy new Generalized4626Strategy contract as there has been a number of gas optimizations since it was first deployed
    const dMetaMorphoStrategyImpl = await deployWithConfirmation(
      "Generalized4626Strategy",
      [
        [addresses.mainnet.MorphoSteakhouseUSDCVault, cVaultProxy.address],
        addresses.mainnet.USDC,
      ],
      undefined,
      true // storage slots have changed since FRAX strategy deployment so force a new deployment
    );
    const cMetaMorpho = await ethers.getContractAt(
      "Generalized4626Strategy",
      dMetaMorphoProxy.address
    );

    // 3. Construct initialize call data to initialize and configure the new strategy
    const initData = cMetaMorpho.interface.encodeFunctionData(
      "initialize()",
      []
    );

    // 4. Init the proxy to point at the implementation, set the governor, and call initialize
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cMetaMorphoProxy.connect(sDeployer)[initFunction](
        dMetaMorphoStrategyImpl.address,
        addresses.mainnet.Timelock, // governor
        initData, // data for delegate call to the initialize function on the strategy
        await getTxOpts()
      )
    );

    // Governance Actions
    // ----------------
    return {
      name: "Add MetaMorpho Strategy to the OUSD Vault",
      actions: [
        {
          // Add the new strategy to the vault
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cMetaMorpho.address],
        },
        {
          // Add the new strategy to the Harvester
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cMetaMorpho.address, true],
        },
        {
          // Set the Harvester in the new strategy
          contract: cMetaMorpho,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);
