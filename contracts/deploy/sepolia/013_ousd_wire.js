/**
 * Sepolia testnet (Remote side) — wire OUSD CCTPAdapter to OUSD Remote.
 *
 *   - chainSelector: addresses.baseSepolia.CCTPDomainId (6) — peer domain.
 *   - safeApproveAllTokens on Remote so USDC→MockOUSDVault deposit-mint,
 *     OUSD→MockWOUSD wrap, and OUSD→outbound allowances are pre-granted.
 */
const addresses = require("../../utils/addresses");

const DEFAULT_DEST_GAS_LIMIT = 500000;
const MIN_FINALITY_THRESHOLD = 1000;
const MIN_TRANSFER_AMOUNT = "1000000"; // 1 USDC
const MAX_TRANSFER_AMOUNT = "10000000000000"; // 10M USDC

module.exports = async (hre) => {
  const { ethers, deployments } = hre;
  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  console.log(`[sepolia] 013_ousd_wire — deployer=${deployerAddr}`);

  const remoteAddr = (await deployments.get("OUSDRemoteStrategyProxy")).address;
  const adapterAddr = (await deployments.get("OUSDCCTPAdapter")).address;

  const cRemote = await ethers.getContractAt(
    "RemoteWOTokenStrategy",
    remoteAddr,
    sDeployer
  );
  const cAdapter = await ethers.getContractAt(
    "CCTPAdapter",
    adapterAddr,
    sDeployer
  );

  const peerDomain = addresses.baseSepolia.CCTPDomainId;
  const chainCfg = {
    paused: false,
    chainSelector: peerDomain,
    destGasLimit: DEFAULT_DEST_GAS_LIMIT,
  };

  // --- Adapter authorisation ---
  if (!(await cAdapter.authorised(remoteAddr))) {
    const tx = await cAdapter.authorise(remoteAddr, chainCfg);
    await tx.wait();
    console.log(
      `CCTPAdapter: authorised Remote for peer domain=${peerDomain} (Base Sepolia)`
    );
  } else {
    console.log(`CCTPAdapter: Remote already authorised`);
  }

  // --- Adapter caps + CCTP-specific config ---
  if ((await cAdapter.maxTransferAmount()).eq(0)) {
    const tx = await cAdapter.setMaxTransferAmount(MAX_TRANSFER_AMOUNT);
    await tx.wait();
    console.log(`CCTPAdapter: maxTransferAmount = 10M USDC`);
  }
  if ((await cAdapter.minFinalityThreshold()) === 0) {
    const tx = await cAdapter.setMinFinalityThreshold(MIN_FINALITY_THRESHOLD);
    await tx.wait();
    console.log(
      `CCTPAdapter: minFinalityThreshold = ${MIN_FINALITY_THRESHOLD}`
    );
  }
  if ((await cAdapter.minTransferAmount()).eq(0)) {
    const tx = await cAdapter.setMinTransferAmount(MIN_TRANSFER_AMOUNT);
    await tx.wait();
    console.log(`CCTPAdapter: minTransferAmount = 1 USDC`);
  }
  if ((await cAdapter.operator()) === ethers.constants.AddressZero) {
    const tx = await cAdapter.setOperator(deployerAddr);
    await tx.wait();
    console.log(`CCTPAdapter: operator = deployer`);
  }

  // --- Wire same adapter as both inbound and outbound on Remote ---
  const currentOutbound = await cRemote.outboundAdapter();
  if (currentOutbound.toLowerCase() !== adapterAddr.toLowerCase()) {
    const tx = await cRemote.setOutboundAdapter(adapterAddr);
    await tx.wait();
    console.log(`Remote.outboundAdapter = CCTPAdapter`);
  }
  const currentInbound = await cRemote.inboundAdapter();
  if (currentInbound.toLowerCase() !== adapterAddr.toLowerCase()) {
    const tx = await cRemote.setInboundAdapter(adapterAddr);
    await tx.wait();
    console.log(`Remote.inboundAdapter = CCTPAdapter`);
  }

  // --- Remote token approvals ---
  // Idempotency guard: skip if USDC→MockOUSDVault allowance already set
  // (OZ safeApprove reverts on non-zero → non-zero).
  const dOTokenVault = await deployments.get("MockOUSDVault");
  const cUsdc = await ethers.getContractAt("IERC20", addresses.sepolia.USDC);
  const existing = await cUsdc.allowance(remoteAddr, dOTokenVault.address);
  if (existing.isZero()) {
    const tx = await cRemote.safeApproveAllTokens();
    await tx.wait();
    console.log(
      `Remote.safeApproveAllTokens() — fresh USDC/OUSD/wOUSD approvals`
    );
  } else {
    console.log(`Remote token approvals already set (skipping)`);
  }

  console.log("\n=== Sepolia OUSD Remote deployment summary ===");
  console.log(`  Remote proxy:      ${remoteAddr}`);
  console.log(`  CCTPAdapter:       ${adapterAddr}`);
  console.log(`  USDC:              ${addresses.sepolia.USDC}`);
  console.log(`  Peer CCTP domain:  ${peerDomain} (Base Sepolia)`);

  return true;
};

module.exports.id = "sepolia_013_ousd_wire";
module.exports.tags = ["sepolia"];
module.exports.dependencies = ["sepolia_012_ousd_cctp_adapter"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "sepolia";
};
