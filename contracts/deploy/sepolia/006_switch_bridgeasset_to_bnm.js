/**
 * Sepolia testnet — switch Remote's bridgeAsset from WETH to CCIP-BnM so the
 * yield channel works on testnet. Companion to baseSepolia/006.
 *
 * Cascade (Remote side):
 *   - MockEthOTokenVault has IMMUTABLE bridgeAsset + oToken → redeploy.
 *   - MockMintableBurnableOToken has IMMUTABLE vaultAddress → redeploy.
 *   - MockERC4626Vault has IMMUTABLE underlying asset → redeploy.
 *   - Remote.bridgeAsset/oToken/woToken/oTokenVault are IMMUTABLE on the impl
 *     (set via BaseStrategyConfig in constructor) → redeploy impl.
 *
 * Steps:
 *   1. Predict new MockOETH address via deployer nonce (chicken-and-egg with the
 *      vault constructor)
 *   2. Deploy new MockEthOTokenVault with bridgeAsset=BnM, oToken=predicted
 *   3. Deploy new MockOETH bound to new vault
 *   4. Deploy new MockWOETH (4626 over new MockOETH)
 *   5. Deploy new Remote impl pointing at v2 mocks + BnM
 *   6. Upgrade Remote proxy
 *   7. Call Remote.safeApproveAllTokens() (fresh impl needs fresh approvals)
 *   8. Overwrite canonical artifacts
 */
const addresses = require("../../utils/addresses");

module.exports = async (hre) => {
  const { ethers, deployments } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  console.log(
    `[sepolia] 006_switch_bridgeasset_to_bnm — deployer=${deployerAddr}`
  );

  const BNM = addresses.sepolia.CCIPBnM;
  console.log(`Target bridgeAsset: CCIP-BnM @ ${BNM}`);

  // --- 1. Predict OToken address (vault constructor needs it) ----------
  const startNonce = await ethers.provider.getTransactionCount(deployerAddr);
  // Sequence: vault deploys at nonce N, OToken at nonce N+1.
  const predictedOTokenAddr = ethers.utils.getContractAddress({
    from: deployerAddr,
    nonce: startNonce + 1,
  });
  console.log(`Predicted MockOETH v2 address: ${predictedOTokenAddr}`);

  // --- 2. Deploy new MockEthOTokenVault with bridgeAsset=BnM -----------
  const dNewVault = await deploy("MockOETHVaultV2", {
    from: deployerAddr,
    contract: "MockEthOTokenVault",
    args: [BNM, predictedOTokenAddr],
    log: true,
  });
  console.log(`MockOETHVault v2: ${dNewVault.address}`);

  // --- 3. Deploy new MockOETH bound to new vault ----------------------
  const dNewOToken = await deploy("MockOETHV2", {
    from: deployerAddr,
    contract: "MockMintableBurnableOToken",
    args: ["Mock OETH", "mOETH", dNewVault.address],
    log: true,
  });
  if (
    dNewOToken.address.toLowerCase() !== predictedOTokenAddr.toLowerCase()
  ) {
    throw new Error(
      `Predicted address mismatch: ${predictedOTokenAddr} vs ${dNewOToken.address}`
    );
  }
  console.log(`MockOETH v2: ${dNewOToken.address}`);

  // --- 4. Deploy new MockWOETH (ERC4626 over new MockOETH) -----------
  const dNewWOToken = await deploy("MockWOETHV2", {
    from: deployerAddr,
    contract: "MockERC4626Vault",
    args: [dNewOToken.address],
    log: true,
  });
  console.log(`MockWOETH v2: ${dNewWOToken.address}`);

  // --- 5. Deploy new Remote impl pointing at v2 mocks + BnM ----------
  const dNewRemoteImpl = await deploy("RemoteWOTokenStrategyV2", {
    from: deployerAddr,
    contract: "RemoteWOTokenStrategy",
    args: [
      {
        platformAddress: dNewWOToken.address, // Remote convention: platformAddress = woToken
        vaultAddress: ethers.constants.AddressZero, // Remote isn't registered with any vault
      },
      BNM,
      dNewOToken.address,
      dNewWOToken.address,
      dNewVault.address,
    ],
    log: true,
  });
  console.log(`RemoteWOTokenStrategy impl v2: ${dNewRemoteImpl.address}`);

  // --- 6. Upgrade Remote proxy ---------------------------------------
  const dRemoteProxy = await deployments.get("RemoteWOTokenStrategyProxy");
  const cRemoteProxyAsProxy = await ethers.getContractAt(
    "InitializeGovernedUpgradeabilityProxy",
    dRemoteProxy.address,
    sDeployer
  );
  const currentImpl = await cRemoteProxyAsProxy.implementation();
  if (currentImpl.toLowerCase() !== dNewRemoteImpl.address.toLowerCase()) {
    const tx = await cRemoteProxyAsProxy.upgradeTo(dNewRemoteImpl.address);
    await tx.wait();
    console.log(
      `Remote proxy upgraded: ${currentImpl} → ${dNewRemoteImpl.address}`
    );
  } else {
    console.log(`Remote proxy already at ${dNewRemoteImpl.address}`);
  }

  // --- 7. Refresh Remote's token approvals ---------------------------
  // The new impl has new bridgeAsset/oToken/woToken/oTokenVault, so the
  // old approvals are useless. Call safeApproveAllTokens unconditionally
  // (idempotency: check BnM→new vault allowance is zero first).
  const cRemote = await ethers.getContractAt(
    "RemoteWOTokenStrategy",
    dRemoteProxy.address,
    sDeployer
  );
  const cBnm = await ethers.getContractAt("IERC20", BNM);
  const existing = await cBnm.allowance(dRemoteProxy.address, dNewVault.address);
  if (existing.isZero()) {
    const tx = await cRemote.safeApproveAllTokens();
    await tx.wait();
    console.log(
      "Remote.safeApproveAllTokens() — fresh BnM/OToken/woToken approvals set"
    );
  } else {
    console.log("Remote token approvals already set on v2 stack (skipping)");
  }

  // --- 8. Overwrite canonical artifacts ------------------------------
  await deployments.save("MockOETHVault", {
    address: dNewVault.address,
    abi: (await deployments.get("MockOETHVaultV2")).abi,
  });
  await deployments.save("MockOETH", {
    address: dNewOToken.address,
    abi: (await deployments.get("MockOETHV2")).abi,
  });
  await deployments.save("MockWOETH", {
    address: dNewWOToken.address,
    abi: (await deployments.get("MockWOETHV2")).abi,
  });
  await deployments.save("RemoteWOTokenStrategy", {
    address: dNewRemoteImpl.address,
    abi: (await deployments.get("RemoteWOTokenStrategyV2")).abi,
  });
  console.log(
    "Canonical artifacts overwritten: MockOETHVault, MockOETH, MockWOETH, RemoteWOTokenStrategy → v2."
  );

  console.log("\n=== Sepolia v2 chain summary ===");
  console.log(`  Remote proxy:       ${dRemoteProxy.address}`);
  console.log(`  Remote impl v2:     ${dNewRemoteImpl.address}`);
  console.log(`  MockOETHVault v2:   ${dNewVault.address}`);
  console.log(`  MockOETH v2:        ${dNewOToken.address}`);
  console.log(`  MockWOETH v2:       ${dNewWOToken.address}`);
  console.log(`  bridgeAsset:        ${BNM} (CCIP-BnM)`);
  console.log(
    "Note: old WETH-based mocks remain on-chain but are orphaned. Use tn:mint-oeth (consumes BnM now)."
  );

  return true;
};

module.exports.id = "sepolia_006_switch_bridgeasset_to_bnm";
module.exports.tags = ["sepolia"];
module.exports.dependencies = ["sepolia_005_wire_remote"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "sepolia";
};
