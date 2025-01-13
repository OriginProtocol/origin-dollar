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

    // 1. Upgrade Dripper to the new version (with transferAll token function)
    // 2. Deploy OETH fixed rate dripper
    // 3. Transfer all funds from old dripper to new dripper
    // 4. Set new dripper on the vault

    // --- 1 ---
    // 1.a. Get the current OETH Dripper Proxy
    const cOETHDripperProxy = await ethers.getContractAt(
      "OETHDripperProxy",
      "0xc0F42F73b8f01849a2DD99753524d4ba14317EB3"
    );

    // 1.b. Deploy the new OETH Dripper implementation
    const dOETHDripper = await deployWithConfirmation(
      "OETHDripper",
      [addresses.mainnet.OETHVaultProxy, addresses.mainnet.WETH],
      undefined,
      true
    );

    const cOETHDripper = await ethers.getContractAt(
      "OETHDripper",
      "0xc0F42F73b8f01849a2DD99753524d4ba14317EB3"
    );

    // --- 2 ---
    // 2.a Deploy the Fixed Rate Dripper Proxy
    const dOETHFixedRateDripperProxy = await deployWithConfirmation(
      "OETHFixedRateDripperProxy"
    );

    const cOETHFixedRateDripperProxy = await ethers.getContract(
      "OETHFixedRateDripperProxy"
    );

    // 2.b. Deploy the OETH Fixed Rate Dripper implementation
    const dOETHFixedRateDripper = await deployWithConfirmation(
      "OETHFixedRateDripper",
      [addresses.mainnet.OETHVaultProxy, addresses.mainnet.WETH]
    );

    // 2.c. Initialize the Fixed Rate Dripper Proxy
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cOETHFixedRateDripperProxy.connect(sDeployer)[initFunction](
        dOETHFixedRateDripper.address,
        addresses.mainnet.Timelock, // governor
        "0x" // no init data
      )
    );
    // --- 3 & 4 ---
    // Governance Actions
    // ----------------
    return {
      name: "",
      actions: [
        // 1. Upgrade the Dripper to the new version
        {
          contract: cOETHDripperProxy,
          signature: "upgradeTo(address)",
          args: [dOETHDripper.address],
        },
        // 3. Transfer all funds from the old dripper to the new dripper
        {
          contract: cOETHDripper,
          signature: "transferAllToken(address,address)",
          args: [addresses.mainnet.WETH, cOETHFixedRateDripperProxy.address],
        },
        // 4. Set new dripper address on the vault
        {
          contract: cOETHVaultProxy,
          signature: "setDripper(address)",
          args: [dOETHFixedRateDripperProxy.address],
        },
      ],
    };
  }
);
