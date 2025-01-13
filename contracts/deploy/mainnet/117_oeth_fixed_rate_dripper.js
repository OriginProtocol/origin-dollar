const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "117_oeth_fixed_rate_dripper",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const cOETHVaultProxy = await ethers.getContractAt(
      "VaultAdmin",
      addresses.mainnet.OETHVaultProxy
    );

    // Deployer Actions
    // ----------------
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // 1. Deploy the Fixed Rate Dripper Proxy
    const dOETHFixedRateDripperProxy = await deployWithConfirmation(
      "OETHFixedRateDripperProxy"
    );

    const cOETHFixedRateDripperProxy = await ethers.getContract(
      "OETHFixedRateDripperProxy"
    );

    // 2. Deploy the OETH Fixed Rate Dripper implementation
    const dOETHFixedRateDripper = await deployWithConfirmation(
      "OETHFixedRateDripper",
      [addresses.mainnet.OETHVaultProxy, addresses.mainnet.WETH]
    );

    // 3. Initialize the Fixed Rate Dripper Proxy
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cOETHFixedRateDripperProxy.connect(sDeployer)[initFunction](
        dOETHFixedRateDripper.address,
        addresses.mainnet.Timelock, // governor
        "0x" // no init data
      )
    );

    // Governance Actions
    // ----------------
    return {
      name: "",
      actions: [
        // Collect on the current OETH dripper
        {
          contract: cOETHVaultProxy,
          signature: "setDripper(address)",
          args: [dOETHFixedRateDripperProxy.address],
        },
      ],
    };
  }
);
