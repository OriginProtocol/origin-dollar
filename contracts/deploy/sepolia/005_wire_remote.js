/**
 * Sepolia testnet (Remote side) — wire adapters to Remote.
 *
 * Sets:
 *   - Remote.outboundAdapter = SuperbridgeAdapter (E→B, L1 mode)
 *   - Remote.inboundAdapter  = CCIPAdapter (B→E)
 *   - Adapter.authorise(Remote, ChainConfig{chainSelector: Base Sepolia})
 *   - CCIPAdapter.setMaxTransferAmount(1000 ether)  — mirror of Base side CCIP cap
 *   - SuperbridgeAdapter.setMaxTransferAmount(0)    — canonical bridge unlimited
 */
const addresses = require("../../utils/addresses");

const DEFAULT_DEST_GAS_LIMIT = 500000;

module.exports = async (hre) => {
  const { ethers, deployments } = hre;
  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  console.log(`[sepolia] 005_wire_remote — deployer=${deployerAddr}`);

  const remoteAddr = (await deployments.get("RemoteWOTokenStrategyProxy"))
    .address;
  const ccipAddr = (await deployments.get("CCIPAdapter")).address;
  const superAddr = (await deployments.get("SuperbridgeAdapter")).address;

  const cRemote = await ethers.getContractAt(
    "RemoteWOTokenStrategy",
    remoteAddr,
    sDeployer
  );
  const cCCIP = await ethers.getContractAt("CCIPAdapter", ccipAddr, sDeployer);
  const cSuper = await ethers.getContractAt(
    "SuperbridgeAdapter",
    superAddr,
    sDeployer
  );

  const peerChainSelector = addresses.baseSepolia.CCIPChainSelector;
  const chainCfg = {
    paused: false,
    chainSelector: peerChainSelector,
    destGasLimit: DEFAULT_DEST_GAS_LIMIT,
  };

  // --- Adapter authorisation + per-lane config ---
  for (const [name, adapter] of [
    ["CCIPAdapter", cCCIP],
    ["SuperbridgeAdapter", cSuper],
  ]) {
    const isAuth = await adapter.authorised(remoteAddr);
    if (!isAuth) {
      const tx = await adapter.authorise(remoteAddr, chainCfg);
      await tx.wait();
      console.log(
        `${name}: authorised Remote for chainSelector=${peerChainSelector}`
      );
    } else {
      console.log(`${name}: Remote already authorised`);
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

  // --- Wire adapters into Remote ---
  const currentOutbound = await cRemote.outboundAdapter();
  if (currentOutbound.toLowerCase() !== superAddr.toLowerCase()) {
    const tx = await cRemote.setOutboundAdapter(superAddr);
    await tx.wait();
    console.log(`Remote.outboundAdapter = SuperbridgeAdapter`);
  }

  const currentInbound = await cRemote.inboundAdapter();
  if (currentInbound.toLowerCase() !== ccipAddr.toLowerCase()) {
    const tx = await cRemote.setInboundAdapter(ccipAddr);
    await tx.wait();
    console.log(`Remote.inboundAdapter = CCIPAdapter`);
  }

  // --- Remote token approvals ---
  // Remote needs to approve (WETH→oTokenVault) for deposit, (oToken→oTokenVault)
  // for withdraw queue, and (oToken→woToken) for ERC-4626 wrap. Skipping this
  // makes every yield/bridge path that touches wOETH revert. Idempotency: skip
  // if the WETH→oTokenVault allowance is already non-zero — OZ safeApprove
  // reverts on non-zero → non-zero so re-calling would fail.
  const dOToken = await deployments.get("MockOETH");
  const dWOToken = await deployments.get("MockWOETH");
  const dOTokenVault = await deployments.get("MockOETHVault");
  const cWeth = await ethers.getContractAt("IERC20", addresses.sepolia.WETH);
  const existingApproval = await cWeth.allowance(
    remoteAddr,
    dOTokenVault.address
  );
  if (existingApproval.isZero()) {
    const tx = await cRemote.safeApproveAllTokens();
    await tx.wait();
    console.log(
      `Remote.safeApproveAllTokens() — approved WETH/${dOToken.address}/${dWOToken.address} → vault/woToken`
    );
  } else {
    console.log(
      `Remote token approvals already set (skipping safeApproveAllTokens)`
    );
  }

  console.log("\n=== Sepolia Remote deployment summary ===");
  console.log(`  Remote proxy:       ${remoteAddr}`);
  console.log(`  CCIPAdapter:        ${ccipAddr}`);
  console.log(`  SuperbridgeAdapter: ${superAddr}`);
  console.log(`  WETH:               ${addresses.sepolia.WETH}`);
  console.log(`  Peer selector:      ${peerChainSelector} (Base Sepolia)`);

  return true;
};

module.exports.id = "sepolia_005_wire_remote";
module.exports.tags = ["sepolia"];
module.exports.dependencies = ["sepolia_004_adapters"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "sepolia";
};
