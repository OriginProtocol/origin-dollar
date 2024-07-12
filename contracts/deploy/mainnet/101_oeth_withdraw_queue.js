const { formatUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "101_oeth_withdraw_queue",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId:
  },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new OETH Vault Core and Admin implementations
    // Need to override the storage safety check as we are repacking the
    // internal assets mapping to just use 1 storage slot
    const dVaultCore = await deployWithConfirmation(
      "OETHVaultCore",
      [addresses.mainnet.WETH, addresses.mainnet.OETHARM],
      null,
      true
    );
    const dVaultAdmin = await deployWithConfirmation(
      "OETHVaultAdmin",
      [addresses.mainnet.WETH],
      null,
      true
    );

    // 2. Connect to the OETH Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);
    const cDripperProxy = await ethers.getContract("OETHDripperProxy");

    const cLidoWithdrawStrategyProxy = await ethers.getContract(
      "LidoWithdrawalStrategyProxy"
    );

    const stETH = await ethers.getContractAt("IERC20", addresses.mainnet.stETH);
    const stEthInVault = await stETH.balanceOf(cVault.address);
    console.log(
      `There is ${formatUnits(stEthInVault)} stETH in the OETH Vault`
    );

    // If there is more than 1 wei of stETH in the Vault, we need to remove it using the Lido Withdrawal Strategy
    const removeStEthActions = stEthInVault.gt(1)
      ? [
          // 1. Deposit all stETH in the Vault to the Lido Withdrawal Strategy
          {
            contract: cVault,
            signature: "depositToStrategy(address,address[],uint256[])",
            args: [
              cLidoWithdrawStrategyProxy.address,
              [stETH.address],
              [stEthInVault],
            ],
          },
          // 2. Remove stETH from the OETH Vault
          {
            contract: cVault,
            signature: "removeAsset(address)",
            args: [stETH.address],
          },
        ]
      : [];

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OETH Vault to support queued withdrawals",
      actions: [
        // Remove stETH if not done already
        ...removeStEthActions,
        // 3. Upgrade the OETH Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 4. set OETH Vault proxy to the new admin vault implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 5. Set the Dripper contract
        {
          contract: cVault,
          signature: "setDripper(address)",
          args: [cDripperProxy.address],
        },
      ],
    };
  }
);
