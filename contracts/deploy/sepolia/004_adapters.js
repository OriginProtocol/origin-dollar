/**
 * Sepolia testnet (Remote side) — adapter deployments.
 *
 * Each adapter is deployed BEHIND a `BridgeAdapterProxy` via CREATE3 with the
 * SAME salt as Base Sepolia. Proxy addresses match across chains (peer
 * parity); the impls differ per chain because they bake chain-specific
 * constructor args (CCIP router, L1StandardBridge, WETH) into bytecode.
 *
 * Routing:
 *   - CCIPAdapter   — inbound (B→E for the yield channel + bridge channel)
 *   - SuperbridgeAdapter L1-mode — outbound (E→B; uses L1StandardBridge for
 *     canonical ETH leg)
 */
const addresses = require("../../utils/addresses");
const {
  deployBridgeAdapterProxy,
  initBridgeAdapterProxy,
} = require("../../utils/createXProxyHelper");

const CCIP_PROXY_SALT = "OETHb V3 Testnet CCIPAdapter Proxy 1";
const SUPER_PROXY_SALT = "OETHb V3 Testnet SuperbridgeAdapter Proxy 1";

module.exports = async (hre) => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await hre.getNamedAccounts();
  console.log(`[sepolia] 004_adapters — deployer=${deployerAddr}`);

  // --- 1. CCIPAdapter impl + proxy ---
  const dCCIPImpl = await deploy("CCIPAdapter", {
    from: deployerAddr,
    args: [addresses.sepolia.CCIPRouter],
    log: true,
  });
  console.log(`CCIPAdapter impl: ${dCCIPImpl.address}`);
  const ccipProxyAddr = await deployBridgeAdapterProxy(
    hre,
    "CCIPAdapter",
    CCIP_PROXY_SALT
  );
  await initBridgeAdapterProxy(hre, ccipProxyAddr, dCCIPImpl.address);

  // --- 2. SuperbridgeAdapter impl + proxy (L1 mode: real L1StandardBridge) ---
  const dSuperImpl = await deploy("SuperbridgeAdapter", {
    from: deployerAddr,
    args: [
      addresses.sepolia.BaseSepoliaL1StandardBridge,
      addresses.sepolia.CCIPRouter,
      addresses.sepolia.WETH,
    ],
    log: true,
  });
  console.log(`SuperbridgeAdapter impl: ${dSuperImpl.address}`);
  const superProxyAddr = await deployBridgeAdapterProxy(
    hre,
    "SuperbridgeAdapter",
    SUPER_PROXY_SALT
  );
  await initBridgeAdapterProxy(hre, superProxyAddr, dSuperImpl.address);

  return true;
};

module.exports.id = "sepolia_004_adapters";
module.exports.tags = ["sepolia"];
module.exports.dependencies = ["sepolia_003_remote_strategy"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "sepolia";
};
