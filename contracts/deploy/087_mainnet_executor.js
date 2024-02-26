const { isCI } = require("../test/helpers");
const addresses = require("../utils/addresses");
const { CCIPChainSelectors } = require("../utils/constants");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");
const { impersonateAndFund } = require("../utils/signers");
const { getTxOpts } = require("../utils/tx");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "087_mainnet_executor",
    deployerIsProposer: false,
    forceSkip: false,
    forceDeploy: false,
    // proposalId: "",
  },
  async ({ ethers }) => {
    const { deployerAddr, timelockAddr } = await getNamedAccounts();

    const executorProxy = await ethers.getContract(
      "MainnetGovernanceExecutorProxy"
    );

    let sDeployer = await ethers.provider.getSigner(deployerAddr);
    if (isCI) {
      sDeployer = await impersonateAndFund(await executorProxy.governor());
    }

    // Deploy MainnetGovernanceExecutor
    await deployWithConfirmation("MainnetGovernanceExecutor", [
      addresses.mainnet.CCIPRouter,
    ]);
    const executorImpl = await ethers.getContract("MainnetGovernanceExecutor");

    // Build initialization data for implementation
    const initData = executorImpl.interface.encodeFunctionData(
      "initialize(uint64[],address[])",
      [
        // Arbitrum One Chain Config
        [CCIPChainSelectors.ArbitrumOne],
        [addresses.arbitrumOne.L2GovernanceProxy],
      ]
    );

    // Initialize Proxy
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      executorProxy.connect(sDeployer)[initFunction](
        executorImpl.address,
        timelockAddr,
        initData, // Implementation initialization
        await getTxOpts()
      )
    );

    return {
      actions: [],
    };
  }
);
