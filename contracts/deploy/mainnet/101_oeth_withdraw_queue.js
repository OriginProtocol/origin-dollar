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
      [addresses.mainnet.WETH],
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
    const cOETHMorphoAaveStrategyProxy = await ethers.getContract(
      "OETHMorphoAaveStrategyProxy"
    );

    const stETH = await ethers.getContractAt("IERC20", addresses.mainnet.stETH);
    const stEthInVault = await stETH.balanceOf(cVault.address);
    console.log(
      `There is ${formatUnits(stEthInVault)} stETH in the OETH Vault`
    );

    const rETH = await ethers.getContractAt("IERC20", addresses.mainnet.rETH);
    const rEthInVault = await rETH.balanceOf(cVault.address);
    console.log(`There is ${formatUnits(rEthInVault)} rETH in the OETH Vault`);

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OETH Vault to support queued withdrawals",
      actions: [
        // 1. Remove the Lido Withdraw Strategy
        {
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [cLidoWithdrawStrategyProxy.address],
        },
        // 2. Remove the Morpho Strategy
        {
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [cOETHMorphoAaveStrategyProxy.address],
        },
        // 3. Remove stETH from the OETH Vault
        {
          contract: cVault,
          signature: "removeAsset(address)",
          args: [stETH.address],
        },
        // 4. Remove rETH from the OETH Vault
        {
          contract: cVault,
          signature: "removeAsset(address)",
          args: [rETH.address],
        },
        // 5. Upgrade the OETH Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 6. set OETH Vault proxy to the new admin vault implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 7. Set the Dripper contract
        {
          contract: cVault,
          signature: "setDripper(address)",
          args: [cDripperProxy.address],
        },
      ],
    };
  }
);
