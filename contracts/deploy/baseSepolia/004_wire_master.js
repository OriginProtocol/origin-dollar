/**
 * Base Sepolia testnet (Master side) — wire adapters to Master and vault.
 *
 * Runs as the deployer (also governor + operator on testnet). Sets:
 *   - Master.outboundAdapter = CCIPAdapter
 *   - Master.inboundAdapter  = SuperbridgeAdapter
 *   - Adapter.authorise(Master, ChainConfig)
 *   - CCIPAdapter.setMaxTransferAmount(1000 ether)  — CCIP testnet WETH lane cap
 *   - SuperbridgeAdapter.setMaxTransferAmount(0)    — canonical bridge unlimited
 *   - L2 vault whitelist Master strategy
 *
 * `chainSelector` in ChainConfig is the DESTINATION selector (Sepolia, since
 * Master sends to Remote on Sepolia and receives from Remote on Sepolia).
 */
const addresses = require("../../utils/addresses");

const DEFAULT_DEST_GAS_LIMIT = 500000;

module.exports = async (hre) => {
  const { ethers, deployments } = hre;
  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  console.log(`[baseSepolia] 004_wire_master — deployer=${deployerAddr}`);

  const masterAddr = (await deployments.get("MasterWOTokenStrategyProxy"))
    .address;
  const ccipAddr = (await deployments.get("CCIPAdapter")).address;
  const superAddr = (await deployments.get("SuperbridgeAdapter")).address;
  const vaultAddr = (await deployments.get("MockOETHbVault")).address;

  const cMaster = await ethers.getContractAt(
    "MasterWOTokenStrategy",
    masterAddr,
    sDeployer
  );
  const cCCIP = await ethers.getContractAt("CCIPAdapter", ccipAddr, sDeployer);
  const cSuper = await ethers.getContractAt(
    "SuperbridgeAdapter",
    superAddr,
    sDeployer
  );
  const cVault = await ethers.getContractAt(
    "MockOTokenVault",
    vaultAddr,
    sDeployer
  );

  const remoteChainSelector = addresses.sepolia.CCIPChainSelector;
  const chainCfg = {
    paused: false,
    chainSelector: remoteChainSelector,
    destGasLimit: DEFAULT_DEST_GAS_LIMIT,
  };

  // --- Adapter authorisation + per-lane config ---
  for (const [name, adapter] of [
    ["CCIPAdapter", cCCIP],
    ["SuperbridgeAdapter", cSuper],
  ]) {
    const isAuth = await adapter.authorised(masterAddr);
    if (!isAuth) {
      const tx = await adapter.authorise(masterAddr, chainCfg);
      await tx.wait();
      console.log(
        `${name}: authorised Master for chainSelector=${remoteChainSelector}`
      );
    } else {
      console.log(`${name}: Master already authorised`);
    }
  }

  // --- Adapter caps ---
  const ccipCap = await cCCIP.maxTransferAmount();
  if (ccipCap.eq(0)) {
    const tx = await cCCIP.setMaxTransferAmount(
      ethers.utils.parseEther("1000")
    );
    await tx.wait();
    console.log("CCIPAdapter: maxTransferAmount = 1000 ether");
  }
  // SuperbridgeAdapter cap stays 0 (unlimited) — canonical bridge has no per-tx cap.

  // --- Wire adapters into Master ---
  const currentOutbound = await cMaster.outboundAdapter();
  if (currentOutbound.toLowerCase() !== ccipAddr.toLowerCase()) {
    const tx = await cMaster.setOutboundAdapter(ccipAddr);
    await tx.wait();
    console.log(`Master.outboundAdapter = CCIPAdapter`);
  }

  const currentInbound = await cMaster.inboundAdapter();
  if (currentInbound.toLowerCase() !== superAddr.toLowerCase()) {
    const tx = await cMaster.setInboundAdapter(superAddr);
    await tx.wait();
    console.log(`Master.inboundAdapter = SuperbridgeAdapter`);
  }

  // --- Vault whitelist Master (for bridge channel mintForStrategy/burnForStrategy) ---
  const whitelisted = await cVault.isMintWhitelistedStrategy(masterAddr);
  if (!whitelisted) {
    const tx = await cVault.whitelistStrategy(masterAddr);
    await tx.wait();
    console.log(`Vault.whitelistStrategy(Master)`);
  }

  console.log("\n=== Base Sepolia Master deployment summary ===");
  console.log(`  Master proxy:       ${masterAddr}`);
  console.log(`  CCIPAdapter:        ${ccipAddr}`);
  console.log(`  SuperbridgeAdapter: ${superAddr}`);
  console.log(`  Mock vault:         ${vaultAddr}`);
  console.log(`  WETH:               ${addresses.baseSepolia.WETH}`);
  console.log(`  Remote selector:    ${remoteChainSelector} (Sepolia)`);

  return true;
};

module.exports.id = "baseSepolia_004_wire_master";
module.exports.tags = ["baseSepolia"];
module.exports.dependencies = ["baseSepolia_003_adapters"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "baseSepolia";
};
