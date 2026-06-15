/**
 * Base Sepolia testnet — switch OETHb V3 bridgeAsset from WETH to CCIP-BnM
 * so the yield channel (deposit / withdraw) works on testnet.
 *
 * WETH isn't whitelisted on CCIP's Base Sepolia ↔ Sepolia lane → Master.deposit
 * reverts with UnsupportedToken(WETH). CCIP-BnM is Chainlink's testnet
 * burn-and-mint token, whitelisted everywhere on CCIP testnet. Same mechanism,
 * different token.
 *
 * Cascade: Master.bridgeAsset is immutable on the impl → redeploy Master impl.
 * MockOETHb.vaultAddress is immutable → redeploy MockOETHb. So:
 *   1. New MockOETHbVault (v4)
 *   2. New MockOETHb (v4) bound to v4 vault
 *   3. Wire v4 vault: setOToken, setBridgeAsset(BnM), setStrategistAddr, whitelist Master
 *   4. New Master impl with bridgeAsset = BnM
 *   5. Upgrade Master proxy
 *   6. Overwrite canonical artifacts
 *
 * Side effect: old WETH-based mock OETHb balances on user wallets are orphaned.
 * Re-mint via tn:mint-oethb under the v4 chain (uses BnM).
 *
 * Idempotent: re-running checks each step and skips if already applied.
 */
const addresses = require("../../utils/addresses");

module.exports = async (hre) => {
  const { ethers, deployments } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  console.log(
    `[baseSepolia] 006_switch_bridgeasset_to_bnm — deployer=${deployerAddr}`
  );

  const BNM = addresses.baseSepolia.CCIPBnM;
  console.log(`Target bridgeAsset: CCIP-BnM @ ${BNM}`);

  // --- 1. Deploy MockOETHbVault v4 --------------------------------------
  const dNewVault = await deploy("MockOETHbVaultV4", {
    from: deployerAddr,
    contract: "MockOTokenVault",
    args: [],
    log: true,
  });
  console.log(`MockOETHbVault v4: ${dNewVault.address}`);

  // --- 2. Deploy MockOETHb v4 bound to v4 vault -------------------------
  const dNewOToken = await deploy("MockOETHbV4", {
    from: deployerAddr,
    contract: "MockMintableBurnableOToken",
    args: ["Mock OETHb", "mOETHb", dNewVault.address],
    log: true,
  });
  console.log(`MockOETHb v4: ${dNewOToken.address}`);

  // --- 3. Wire v4 vault -------------------------------------------------
  const cNewVault = await ethers.getContractAt(
    "MockOTokenVault",
    dNewVault.address,
    sDeployer
  );
  if ((await cNewVault.oToken()) === ethers.constants.AddressZero) {
    const tx = await cNewVault.setOToken(dNewOToken.address);
    await tx.wait();
    console.log("v4 vault: setOToken(MockOETHb v4)");
  }
  if ((await cNewVault.bridgeAsset()) === ethers.constants.AddressZero) {
    const tx = await cNewVault.setBridgeAsset(BNM);
    await tx.wait();
    console.log("v4 vault: setBridgeAsset(CCIP-BnM)");
  }
  if ((await cNewVault.strategistAddr()) === ethers.constants.AddressZero) {
    const tx = await cNewVault.setStrategistAddr(deployerAddr);
    await tx.wait();
    console.log("v4 vault: setStrategistAddr(deployer)");
  }
  const dMasterProxy = await deployments.get("MasterWOTokenStrategyProxy");
  if (!(await cNewVault.isMintWhitelistedStrategy(dMasterProxy.address))) {
    const tx = await cNewVault.whitelistStrategy(dMasterProxy.address);
    await tx.wait();
    console.log(`v4 vault: whitelistStrategy(${dMasterProxy.address})`);
  }

  // --- 4. Deploy new Master impl with bridgeAsset = BnM, oToken = v4 ----
  const dNewMasterImpl = await deploy("MasterWOTokenStrategyV4", {
    from: deployerAddr,
    contract: "MasterWOTokenStrategy",
    args: [
      {
        platformAddress: ethers.constants.AddressZero,
        vaultAddress: dNewVault.address,
      },
      BNM,
      dNewOToken.address,
    ],
    log: true,
  });
  console.log(`MasterWOTokenStrategy impl v4: ${dNewMasterImpl.address}`);

  // --- 5. Upgrade Master proxy -----------------------------------------
  const cMasterProxyAsProxy = await ethers.getContractAt(
    "InitializeGovernedUpgradeabilityProxy",
    dMasterProxy.address,
    sDeployer
  );
  const currentImpl = await cMasterProxyAsProxy.implementation();
  if (currentImpl.toLowerCase() !== dNewMasterImpl.address.toLowerCase()) {
    const tx = await cMasterProxyAsProxy.upgradeTo(dNewMasterImpl.address);
    await tx.wait();
    console.log(
      `Master proxy upgraded: ${currentImpl} → ${dNewMasterImpl.address}`
    );
  } else {
    console.log(`Master proxy already at ${dNewMasterImpl.address}`);
  }

  // --- 6. Overwrite canonical artifacts --------------------------------
  await deployments.save("MockOETHbVault", {
    address: dNewVault.address,
    abi: (await deployments.get("MockOETHbVaultV4")).abi,
  });
  await deployments.save("MockOETHb", {
    address: dNewOToken.address,
    abi: (await deployments.get("MockOETHbV4")).abi,
  });
  await deployments.save("MasterWOTokenStrategy", {
    address: dNewMasterImpl.address,
    abi: (await deployments.get("MasterWOTokenStrategyV4")).abi,
  });
  console.log(
    "Canonical artifacts overwritten: MockOETHbVault, MockOETHb, MasterWOTokenStrategy → v4."
  );

  console.log("\n=== Base Sepolia v4 chain summary ===");
  console.log(`  Master proxy:       ${dMasterProxy.address}`);
  console.log(`  Master impl v4:     ${dNewMasterImpl.address}`);
  console.log(`  MockOETHbVault v4:  ${dNewVault.address}`);
  console.log(`  MockOETHb v4:       ${dNewOToken.address}`);
  console.log(`  bridgeAsset:        ${BNM} (CCIP-BnM)`);
  console.log(`  Strategist:         ${deployerAddr}`);
  console.log(
    "Note: any OETHb on the old v3 MockOETHb is orphaned. Use tn:mint-oethb under v4 (consumes BnM)."
  );

  return true;
};

module.exports.id = "baseSepolia_006_switch_bridgeasset_to_bnm";
module.exports.tags = ["baseSepolia"];
module.exports.dependencies = ["baseSepolia_005_redeploy_mock_vault"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "baseSepolia";
};
