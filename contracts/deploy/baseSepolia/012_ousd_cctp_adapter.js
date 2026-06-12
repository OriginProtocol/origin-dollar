/**
 * Base Sepolia testnet — CCTPAdapter for the OUSD V3 stack.
 *
 * One adapter for both inbound AND outbound (CCTP V2 carries token+message
 * in a single call, so no Superbridge split needed).
 *
 * Artifacts registered:
 *   - OUSDCCTPAdapter  (BridgeAdapterProxy at deterministic CREATE3 address)
 *   - OUSDCCTPAdapter_Implementation  (chain-specific CCTPAdapter impl)
 */
const addresses = require("../../utils/addresses");
const {
  deployBridgeAdapterProxy,
  initBridgeAdapterProxy,
} = require("../../utils/createXProxyHelper");

const PROXY_SALT = "OUSD V3 Testnet CCTPAdapter Proxy 1";

module.exports = async (hre) => {
  const { ethers, deployments } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  console.log(`[baseSepolia] 012_ousd_cctp_adapter — deployer=${deployerAddr}`);

  // --- 1. CCTPAdapter impl ---
  const dCCTPImpl = await deploy("OUSDCCTPAdapter_Implementation", {
    from: deployerAddr,
    contract: "CCTPAdapter",
    args: [
      addresses.baseSepolia.USDC,
      addresses.CCTPTokenMessengerV2,
      addresses.CCTPMessageTransmitterV2,
    ],
    log: true,
  });
  console.log(`OUSDCCTPAdapter impl: ${dCCTPImpl.address}`);

  // --- 2. BridgeAdapterProxy via CREATE3 (peer parity with Sepolia) ---
  const proxyAddr = await deployBridgeAdapterProxy(
    hre,
    "OUSDCCTPAdapter",
    PROXY_SALT
  );
  await initBridgeAdapterProxy(hre, proxyAddr, dCCTPImpl.address);

  // --- 3. Upgrade proxy if impl drifted from canonical artifact ---
  // hardhat-deploy redeploys the impl when its source changes; sync the proxy
  // pointer so re-runs after a contract change actually pick up the new code.
  const cProxy = await ethers.getContractAt(
    "InitializeGovernedUpgradeabilityProxy",
    proxyAddr,
    sDeployer
  );
  const currentImpl = await cProxy.implementation();
  if (currentImpl.toLowerCase() !== dCCTPImpl.address.toLowerCase()) {
    const tx = await cProxy.upgradeTo(dCCTPImpl.address);
    await tx.wait();
    console.log(`  → proxy upgraded: ${currentImpl} → ${dCCTPImpl.address}`);
  }

  return true;
};

module.exports.id = "baseSepolia_012_ousd_cctp_adapter";
module.exports.tags = ["baseSepolia"];
module.exports.dependencies = ["baseSepolia_011_ousd_master"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "baseSepolia";
};
