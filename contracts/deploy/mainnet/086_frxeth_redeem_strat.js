const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "086_frxeth_redeem_strat",
    forceDeploy: false,
    //forceSkip: true,
    deployerIsProposer: false,
    proposalId:
      "22557697356425922748429758763228961417125309248972402797899806770489027739571",
  },
  async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    // Deployer Actions
    // ----------------

    // 1. Deploy new strategy proxy
    const dStrategyProxy = await deployWithConfirmation(
      "FrxEthRedeemStrategyProxy"
    );
    const cStrategyProxy = await ethers.getContractAt(
      "FrxEthRedeemStrategyProxy",
      dStrategyProxy.address
    );
    // 2. Deploy new stratgey implimentation
    const dStrategyImpl = await deployWithConfirmation("FrxEthRedeemStrategy", [
      [addresses.zero, cVaultProxy.address],
    ]);
    const cStrategyImpl = await ethers.getContractAt(
      "FrxEthRedeemStrategy",
      dStrategyImpl.address
    );

    // 3. Initialize Proxy with new implementation and strategy initialization

    const initData = cStrategyImpl.interface.encodeFunctionData(
      "initialize(address[],address[],address[])",
      [
        [], // reward token addresses
        [], // asset token addresses
        [], // platform tokens addresses
      ]
    );

    // 4. Init the proxy to point at the implementation, set the governor, and call initialize
    const proxyInitFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cStrategyProxy.connect(sDeployer)[proxyInitFunction](
        cStrategyImpl.address,
        addresses.mainnet.Timelock, // governance
        initData, // data for call to the initialize function on the strategy
        await getTxOpts()
      )
    );

    console.log("Strategy address: ", cStrategyProxy.address);

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new OETH FrxEth Redeem Strategy\n\nThis proposal adds a new FrxEth Redeem Strategy to the OETH vault. The strategy will be used to convert FrxEth tokens to Eth during transition from a multi-asset OETH to simplifed OETH backed only by ETH.",
      actions: [
        // 1. Add new strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cStrategyProxy.address],
        },
      ],
    };
  }
);
