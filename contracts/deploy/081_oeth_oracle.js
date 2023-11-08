const addresses = require("../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  withConfirmation,
} = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "081_oeth_oracle",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ ethers, deployWithConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // 1. Connect to the OETH Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");

    // 2. Deploy the new Vault implementation
    const dVaultCore = await deployWithConfirmation("OETHVaultCore");

    // 3. Deploy the new Oracle contracts
    const dOETHOracleUpdater = await deployWithConfirmation(
      "OETHOracleUpdater",
      [cVaultProxy.address, addresses.mainnet.CurveOETHMetaPool]
    );
    const cOETHOracleUpdater = await ethers.getContractAt(
      "OETHOracleUpdater",
      dOETHOracleUpdater.address
    );
    const dOETHOracle = await deployWithConfirmation("OETHOracle", [
      dOETHOracleUpdater.address,
    ]);
    const cOETHOracle = await ethers.getContractAt(
      "OETHOracleUpdater",
      dOETHOracle.address
    );

    // 4. Transfer governance
    await withConfirmation(
      cOETHOracleUpdater
        .connect(sDeployer)
        .transferGovernance(addresses.mainnet.Timelock)
    );
    await withConfirmation(
      cOETHOracle
        .connect(sDeployer)
        .transferGovernance(addresses.mainnet.Timelock)
    );

    // 4. Governance Actions
    return {
      name: "Upgrade the OETH Vault and deploy the OETH Oracle and Oracle Updater.",
      actions: [
        // 1. Upgrade the OETH Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
      ],
    };
  }
);
