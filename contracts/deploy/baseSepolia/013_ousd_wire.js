/**
 * Base Sepolia testnet — wire OUSD CCTPAdapter to OUSD Master + vault.
 *
 * Single CCTPAdapter handles both inbound and outbound. CCTP V2 carries
 * token+message in one shot, so no Superbridge split needed.
 *
 *   - chainSelector: addresses.sepolia.CCTPDomainId (0)   — CCTPAdapter
 *     stores the CCTP `domain` in the same `chainSelector` field that
 *     CCIPAdapter uses for CCIP chain IDs. Adapter type drives the
 *     interpretation.
 *   - setMinFinalityThreshold: 1000 (fast finality, ~13min, non-zero protocol fee in USDC)
 *   - setMinTransferAmount: 1e6 (1 USDC dust floor)
 *   - setOperator: deployer (single permissioned relayer on testnet)
 */
const addresses = require("../../utils/addresses");

const DEFAULT_DEST_GAS_LIMIT = 500000;
const MIN_FINALITY_THRESHOLD = 1000; // fast finality
const MIN_TRANSFER_AMOUNT = "1000000"; // 1 USDC (6 decimals)
const MAX_TRANSFER_AMOUNT = "10000000000000"; // 10M USDC — matches CCTPAdapter.MAX_TRANSFER_AMOUNT

module.exports = async (hre) => {
  const { ethers, deployments } = hre;
  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  console.log(`[baseSepolia] 013_ousd_wire — deployer=${deployerAddr}`);

  const masterAddr = (await deployments.get("OUSDMasterStrategyProxy")).address;
  const adapterAddr = (await deployments.get("OUSDCCTPAdapter")).address;
  const vaultAddr = (await deployments.get("MockOUSDbVault")).address;

  const cMaster = await ethers.getContractAt(
    "MasterWOTokenStrategy",
    masterAddr,
    sDeployer
  );
  const cAdapter = await ethers.getContractAt(
    "CCTPAdapter",
    adapterAddr,
    sDeployer
  );
  const cVault = await ethers.getContractAt(
    "MockOTokenVault",
    vaultAddr,
    sDeployer
  );

  // chainSelector for CCTPAdapter = peer CCTP domain id (Sepolia = 0).
  const peerDomain = addresses.sepolia.CCTPDomainId;
  const chainCfg = {
    paused: false,
    chainSelector: peerDomain,
    destGasLimit: DEFAULT_DEST_GAS_LIMIT,
  };

  // --- Adapter authorisation ---
  if (!(await cAdapter.authorised(masterAddr))) {
    const tx = await cAdapter.authorise(masterAddr, chainCfg);
    await tx.wait();
    console.log(
      `CCTPAdapter: authorised Master for peer domain=${peerDomain} (Sepolia)`
    );
  } else {
    console.log(`CCTPAdapter: Master already authorised`);
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

  // --- Wire same adapter as both inbound and outbound on Master ---
  const currentOutbound = await cMaster.outboundAdapter();
  if (currentOutbound.toLowerCase() !== adapterAddr.toLowerCase()) {
    const tx = await cMaster.setOutboundAdapter(adapterAddr);
    await tx.wait();
    console.log(`Master.outboundAdapter = CCTPAdapter`);
  }
  const currentInbound = await cMaster.inboundAdapter();
  if (currentInbound.toLowerCase() !== adapterAddr.toLowerCase()) {
    const tx = await cMaster.setInboundAdapter(adapterAddr);
    await tx.wait();
    console.log(`Master.inboundAdapter = CCTPAdapter`);
  }

  // --- Vault whitelist Master ---
  if (!(await cVault.isMintWhitelistedStrategy(masterAddr))) {
    const tx = await cVault.whitelistStrategy(masterAddr);
    await tx.wait();
    console.log(`MockOUSDbVault.whitelistStrategy(Master)`);
  }

  console.log("\n=== Base Sepolia OUSD Master deployment summary ===");
  console.log(`  Master proxy:      ${masterAddr}`);
  console.log(`  CCTPAdapter:       ${adapterAddr}`);
  console.log(`  Mock vault:        ${vaultAddr}`);
  console.log(`  USDC:              ${addresses.baseSepolia.USDC}`);
  console.log(`  Peer CCTP domain:  ${peerDomain} (Sepolia)`);

  return true;
};

module.exports.id = "baseSepolia_013_ousd_wire";
module.exports.tags = ["baseSepolia"];
module.exports.dependencies = ["baseSepolia_012_ousd_cctp_adapter"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "baseSepolia";
};
