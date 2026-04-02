const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "187_upgrade_curve_amo_morpho_harvester",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "5697338543179287508027975880456202542180347418093553007770592038448546628804",
  },
  async ({ deployWithConfirmation }) => {
    // ── Proxy handles ────────────────────────────────────────────────────────
    const cOUSDCurveAMOProxy = await ethers.getContract("OUSDCurveAMOProxy");
    const cOETHCurveAMOProxy = await ethers.getContract("OETHCurveAMOProxy");
    const cOUSDMorphoV2Proxy = await ethers.getContract(
      "OUSDMorphoV2StrategyProxy"
    );

    // Strategy contract handles (used to call governor functions via proxy)
    const cOUSDCurveAMO = await ethers.getContractAt(
      "CurveAMOStrategy",
      cOUSDCurveAMOProxy.address
    );
    const cOETHCurveAMO = await ethers.getContractAt(
      "CurveAMOStrategy",
      cOETHCurveAMOProxy.address
    );
    const cOUSDMorphoV2 = await ethers.getContractAt(
      "MorphoV2Strategy",
      cOUSDMorphoV2Proxy.address
    );

    // ── Deploy new implementations ────────────────────────────────────────────
    // Both AMOs use CurveAMOStrategy but with different constructor args,
    // so they get distinct artifact names.

    // 1. OUSD/USDC Curve AMO
    const dOUSDCurveAMO = await deployWithConfirmation(
      "OUSDCurveAMOStrategy",
      [
        [
          addresses.mainnet.curve.OUSD_USDC.pool, // platformAddress (Curve pool = LP token)
          addresses.mainnet.VaultProxy, // vaultAddress
        ],
        addresses.mainnet.OUSDProxy, // _otoken
        addresses.mainnet.USDC, // _hardAsset
        addresses.mainnet.curve.OUSD_USDC.gauge, // _gauge
        addresses.mainnet.CRVMinter, // _minter
      ],
      "CurveAMOStrategy", // actual contract to compile
      true
    );

    // 2. OETH/WETH Curve AMO
    const dOETHCurveAMO = await deployWithConfirmation(
      "OETHCurveAMOStrategy",
      [
        [
          addresses.mainnet.curve.OETH_WETH.pool, // platformAddress
          addresses.mainnet.OETHVaultProxy, // vaultAddress
        ],
        addresses.mainnet.OETHProxy, // _otoken (OETH)
        addresses.mainnet.WETH, // _hardAsset
        addresses.mainnet.curve.OETH_WETH.gauge, // _gauge
        addresses.mainnet.CRVMinter, // _minter
      ],
      "CurveAMOStrategy",
      true
    );

    // 3. OUSD Morpho V2
    const dOUSDMorphoV2 = await deployWithConfirmation(
      "MorphoV2Strategy",
      [
        [
          addresses.mainnet.MorphoOUSDv2Vault, // platformAddress
          addresses.mainnet.VaultProxy, // vaultAddress
        ],
        addresses.mainnet.USDC, // _assetToken
      ],
      undefined,
      true
    );

    // ── Governance actions ────────────────────────────────────────────────────
    return {
      name: "Upgrade Curve AMO and Morpho V2 strategy implementations and set CoW Harvester",
      actions: [
        // 1. Upgrade OUSD Curve AMO
        {
          contract: cOUSDCurveAMOProxy,
          signature: "upgradeTo(address)",
          args: [dOUSDCurveAMO.address],
        },
        // 2. Set Multichain Strategist on OUSD Curve AMO
        {
          contract: cOUSDCurveAMO,
          signature: "setHarvesterAddress(address)",
          args: [addresses.multichainStrategist],
        },
        // 3. Upgrade OETH Curve AMO
        {
          contract: cOETHCurveAMOProxy,
          signature: "upgradeTo(address)",
          args: [dOETHCurveAMO.address],
        },
        // 4. Set Multichain Strategist on OETH Curve AMO
        {
          contract: cOETHCurveAMO,
          signature: "setHarvesterAddress(address)",
          args: [addresses.multichainStrategist],
        },
        // 5. Upgrade OUSD Morpho V2
        {
          contract: cOUSDMorphoV2Proxy,
          signature: "upgradeTo(address)",
          args: [dOUSDMorphoV2.address],
        },
        // 6. Set CoW Harvester on OUSD Morpho V2
        {
          contract: cOUSDMorphoV2,
          signature: "setHarvesterAddress(address)",
          args: [addresses.mainnet.CoWHarvester],
        },
      ],
    };
  }
);
