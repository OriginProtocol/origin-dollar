/**
 * Base Sepolia testnet (Master side) — adapter deployments.
 *
 * Each adapter is deployed BEHIND a `BridgeAdapterProxy` via CREATE3. The
 * proxy gets a deterministic address (because its initcode contains only a
 * fixed governor placeholder), matching the Sepolia (Remote) side. The impl
 * is deployed plain with chain-specific constructor args (CCIPRouter,
 * L1StandardBridge, WETH). Impl addresses differ across chains but only the
 * proxy is part of the adapter's `transportSender == address(this)`
 * peer-parity check, so that's fine.
 *
 * Routing:
 *   - CCIPAdapter   — outbound (B→E for the yield channel, B→E for bridge channel)
 *   - SuperbridgeAdapter L2-mode — inbound (E→B; L1StandardBridge unused on this side)
 */
const addresses = require("../../utils/addresses");
const {
  deployBridgeAdapterProxy,
  initBridgeAdapterProxy,
} = require("../../utils/createXProxyHelper");

const CCIP_PROXY_SALT = "OETHb V3 Testnet CCIPAdapter Proxy 1";
const SUPER_PROXY_SALT = "OETHb V3 Testnet SuperbridgeAdapter Proxy 1";

module.exports = async (hre) => {
  const { ethers, deployments } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await hre.getNamedAccounts();
  console.log(`[baseSepolia] 003_adapters — deployer=${deployerAddr}`);

  // --- 1. CCIPAdapter impl + proxy ---
  const dCCIPImpl = await deploy("CCIPAdapter", {
    from: deployerAddr,
    args: [addresses.baseSepolia.CCIPRouter],
    log: true,
  });
  console.log(`CCIPAdapter impl: ${dCCIPImpl.address}`);
  const ccipProxyAddr = await deployBridgeAdapterProxy(
    hre,
    "CCIPAdapter",
    CCIP_PROXY_SALT
  );
  await initBridgeAdapterProxy(hre, ccipProxyAddr, dCCIPImpl.address);

  // --- 2. SuperbridgeAdapter impl + proxy (L2 mode: _l1 = 0) ---
  const dSuperImpl = await deploy("SuperbridgeAdapter", {
    from: deployerAddr,
    args: [
      ethers.constants.AddressZero,
      addresses.baseSepolia.CCIPRouter,
      addresses.baseSepolia.WETH,
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

module.exports.id = "baseSepolia_003_adapters";
module.exports.tags = ["baseSepolia"];
module.exports.dependencies = ["baseSepolia_002_master_strategy"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "baseSepolia";
};
