const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "098_lido_withdrawal_strategy",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "72348788472639134460868886015864856000028908615792027540418387501511877625568",
  },
  async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "OETHVaultAdmin",
      cVaultProxy.address
    );

    // Deployer Actions
    // ----------------

    // 1. Deploy the Lido Withdrawal Strategy
    const dWithdrawalStrategyStrategyProxy = await deployWithConfirmation(
      "LidoWithdrawalStrategyProxy"
    );
    const cWithdrawalStrategyStrategyProxy = await ethers.getContractAt(
      "LidoWithdrawalStrategyProxy",
      dWithdrawalStrategyStrategyProxy.address
    );
    const dWithdrawalStrategyImpl = await deployWithConfirmation(
      "LidoWithdrawalStrategy",
      [
        [addresses.zero, cVaultProxy.address], //_baseConfig
      ]
    );
    const cWithdrawalStrategyImpl = await ethers.getContractAt(
      "LidoWithdrawalStrategy",
      dWithdrawalStrategyImpl.address
    );

    // 2. Init the Lido Withdrawal strategy proxy to point at the implementation, set the governor, and call initialize
    const withdrawalInitData =
      cWithdrawalStrategyImpl.interface.encodeFunctionData(
        "initialize(address[],address[],address[])",
        [
          [], // reward token addresses
          [], // asset token addresses
          [], // platform tokens addresses
        ]
      );
    const proxyInitFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cWithdrawalStrategyStrategyProxy.connect(sDeployer)[proxyInitFunction](
        cWithdrawalStrategyImpl.address,
        addresses.mainnet.Timelock, // governance
        withdrawalInitData, // data for call to the initialize function on the strategy
        await getTxOpts()
      )
    );

    // Governance Actions
    // ----------------
    return {
      name: `Deployed a new strategy to convert stETH to WETH at 1:1 using the Lido withdrawal queue.`,
      actions: [
        // 1. Add new Lido Withdrawal Strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cWithdrawalStrategyStrategyProxy.address],
        },
      ],
    };
  }
);
