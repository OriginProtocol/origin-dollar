const { expect } = require("chai");

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
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

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
      "OETHOracle",
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

    // 5. Deploy the new OETH Oracle Router
    await deployWithConfirmation("OETHOracleRouter", [], null, true);
    const cOETHOracleRouter = await ethers.getContract("OETHOracleRouter");

    // Putting checks in here are the fixture replaced the OETHOracleRouter implementation
    expect(await cOETHOracleRouter.isDecimalsValid(addresses.mainnet.WETH)).to
      .be.true;
    expect(await cOETHOracleRouter.isDecimalsValid(addresses.mainnet.stETH)).to
      .be.true;
    expect(await cOETHOracleRouter.isDecimalsValid(addresses.mainnet.rETH)).to
      .be.true;
    expect(await cOETHOracleRouter.isDecimalsValid(addresses.mainnet.frxETH)).to
      .be.true;
    expect(await cOETHOracleRouter.isDecimalsValid(addresses.mainnet.CRV)).to.be
      .true;
    expect(await cOETHOracleRouter.isDecimalsValid(addresses.mainnet.CVX)).to.be
      .true;

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
        // 2. Accept governance for OETHOracleUpdater
        {
          contract: cOETHOracleUpdater,
          signature: "claimGovernance()",
          args: [],
        },
        // 3. Accept governance for OETHOracle
        {
          contract: cOETHOracle,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cVaultAdmin,
          signature: "setPriceProvider(address)",
          args: [cOETHOracleRouter.address],
        },
      ],
    };
  }
);
