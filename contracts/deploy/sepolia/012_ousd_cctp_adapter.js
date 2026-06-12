/**
 * Sepolia testnet (Remote side) — CCTPAdapter for the OUSD V3 stack.
 *
 * Same salt as Base Sepolia's 012 → proxy address is identical on both
 * chains (peer parity for `transportSender == address(this)` checks).
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
  console.log(`[sepolia] 012_ousd_cctp_adapter — deployer=${deployerAddr}`);

  const dCCTPImpl = await deploy("OUSDCCTPAdapter_Implementation", {
    from: deployerAddr,
    contract: "CCTPAdapter",
    args: [
      addresses.sepolia.USDC,
      addresses.CCTPTokenMessengerV2,
      addresses.CCTPMessageTransmitterV2,
    ],
    log: true,
  });
  console.log(`OUSDCCTPAdapter impl: ${dCCTPImpl.address}`);

  const proxyAddr = await deployBridgeAdapterProxy(
    hre,
    "OUSDCCTPAdapter",
    PROXY_SALT
  );
  await initBridgeAdapterProxy(hre, proxyAddr, dCCTPImpl.address);

  // Upgrade proxy if impl drifted (re-run after AbstractAdapter change).
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

module.exports.id = "sepolia_012_ousd_cctp_adapter";
module.exports.tags = ["sepolia"];
module.exports.dependencies = ["sepolia_011_ousd_remote"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "sepolia";
};
