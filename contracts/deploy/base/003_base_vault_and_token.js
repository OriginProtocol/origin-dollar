const { deployOnBase } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "003_base_vault_and_token",
  },
  async ({ ethers }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Proxies
    await deployWithConfirmation("OETHBaseProxy");
    await deployWithConfirmation("WOETHBaseProxy");
    await deployWithConfirmation("OETHBaseVaultProxy");

    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
    const cwOETHbProxy = await ethers.getContract("WOETHBaseProxy");
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

    // Core contracts
    const dOETHb = await deployWithConfirmation("OETH");
    const dwOETHb = await deployWithConfirmation("WOETHBase", [
      cOETHbProxy.address, // Base token
      "Wrapped OETH Base",
      "wOETHb",
    ]);
    const dOETHbVault = await deployWithConfirmation("OETHVault");
    const dOETHbVaultCore = await deployWithConfirmation("OETHBaseVaultCore", [
      addresses.base.WETH,
    ]);
    const dOETHbVaultAdmin = await deployWithConfirmation("OETHBaseVaultAdmin");

    // Get contract instances
    const cOETHb = await ethers.getContractAt("OETH", cOETHbProxy.address);
    const cwOETHb = await ethers.getContractAt(
      "WOETHBase",
      cwOETHbProxy.address
    );
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );
    const cOracleRouter = await ethers.getContract("OETHBaseOracleRouter");

    // Init OETHb
    const resolution = ethers.utils.parseUnits("1", 27);
    const initDataOETHb = cOETHb.interface.encodeFunctionData(
      "initialize(string,string,address,uint256)",
      [
        "OETH Base",
        "OETHb", // Token Symbol
        cOETHbVaultProxy.address, // OETHb Vault
        resolution, // HighRes
      ]
    );
    // prettier-ignore
    await withConfirmation(
      cOETHbProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dOETHb.address,
          deployerAddr,
          initDataOETHb
        )
    );
    console.log("Initialized OETHBaseProxy and OETHBase implementation");

    // Init OETHbVault
    const initDataOETHbVault = cOETHbVault.interface.encodeFunctionData(
      "initialize(address,address)",
      [
        cOracleRouter.address, // OracleRouter
        cOETHbProxy.address, // OETHb
      ]
    );
    // prettier-ignore
    await withConfirmation(
      cOETHbVaultProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dOETHbVault.address,
          deployerAddr,
          initDataOETHbVault
        )
    );
    console.log("Initialized OETHBaseVaultProxy and implementation");

    // Init wOETHb
    const initDatawOETHb = cwOETHb.interface.encodeFunctionData(
      "initialize()",
      []
    );
    // prettier-ignore
    await withConfirmation(
      cwOETHbProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dwOETHb.address,
          // No need for additional governance transfer,
          // since deployer doesn't have to configure anything
          governorAddr,
          initDatawOETHb
        )
    );
    console.log("Initialized WOETHBaseProxy and implementation");

    // Set Core Impl
    await withConfirmation(
      cOETHbVaultProxy.connect(sDeployer).upgradeTo(dOETHbVaultCore.address)
    );
    console.log("Set OETHBaseVaultCore implementation");

    // Set Admin Impl
    await withConfirmation(
      cOETHbVault.connect(sDeployer).setAdminImpl(dOETHbVaultAdmin.address)
    );
    console.log("Set OETHBaseVaultAdmin implementation");

    // Transfer ownership
    await withConfirmation(
      cOETHbVaultProxy.connect(sDeployer).transferGovernance(governorAddr)
    );
    await withConfirmation(
      cOETHbProxy.connect(sDeployer).transferGovernance(governorAddr)
    );
    console.log("Transferred Governance");

    return {
      actions: [
        {
          // 1. Claim Governance on OETHb
          contract: cOETHbProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          // 2. Claim Governance on OETHbVault
          contract: cOETHbVaultProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          // 3. Allow minting with WETH
          contract: cOETHbVault,
          signature: "supportAsset(address,uint8)",
          args: [
            addresses.base.WETH,
            0, // Decimal
          ],
        },
        {
          // 4. Unpause Capital
          contract: cOETHbVault,
          signature: "unpauseCapital()",
          args: [],
        },
        {
          // 5. Upgrade wOETHb
          contract: cwOETHbProxy,
          signature: "upgradeTo(address)",
          args: [dwOETHb.address],
        },
      ],
    };
  }
);
