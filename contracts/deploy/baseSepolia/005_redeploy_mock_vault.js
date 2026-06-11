/**
 * Base Sepolia testnet — redeploy the OETHb mock chain with production-mirror surface.
 *
 * The original MockOTokenVault lacked a user-facing `mint(amount)` / `redeem`. Fix is
 * additive on the contract (added mint + redeem + bridgeAsset setter), but rolling it
 * out on-chain is a cascade:
 *
 *   MockMintableBurnableOToken.vaultAddress is `immutable` (set in constructor)
 *   → cannot point the EXISTING MockOETHb at a new vault. Must redeploy MockOETHb.
 *   Master.oToken is also `immutable` (BaseStrategyConfig — set in constructor)
 *   → must redeploy Master IMPL with the new MockOETHb. Proxy address survives.
 *
 * Uses `_v3` suffix because a partial `_v2` attempt from an earlier run is on-chain.
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
    `[baseSepolia] 005_redeploy_mock_vault — deployer=${deployerAddr}`
  );

  // --- 1. Deploy new MockOETHbVault (v3) ----------------------------------
  const dNewVault = await deploy("MockOETHbVaultV3", {
    from: deployerAddr,
    contract: "MockOTokenVault",
    args: [],
    log: true,
  });
  console.log(`MockOETHbVault v3: ${dNewVault.address}`);

  // --- 2. Deploy new MockOETHb (v3) bound to the new vault ----------------
  // vaultAddress is immutable on the OToken, so a new vault REQUIRES a new OToken.
  const dNewOToken = await deploy("MockOETHbV3", {
    from: deployerAddr,
    contract: "MockMintableBurnableOToken",
    args: ["Mock OETHb", "mOETHb", dNewVault.address],
    log: true,
  });
  console.log(`MockOETHb v3: ${dNewOToken.address}`);

  // --- 3. Wire the new vault ----------------------------------------------
  const cNewVault = await ethers.getContractAt(
    "MockOTokenVault",
    dNewVault.address,
    sDeployer
  );

  if ((await cNewVault.oToken()) === ethers.constants.AddressZero) {
    const tx = await cNewVault.setOToken(dNewOToken.address);
    await tx.wait();
    console.log("New vault: setOToken(MockOETHb v3)");
  }
  if ((await cNewVault.bridgeAsset()) === ethers.constants.AddressZero) {
    const tx = await cNewVault.setBridgeAsset(addresses.baseSepolia.WETH);
    await tx.wait();
    console.log("New vault: setBridgeAsset(WETH)");
  }
  if ((await cNewVault.strategistAddr()) === ethers.constants.AddressZero) {
    const tx = await cNewVault.setStrategistAddr(deployerAddr);
    await tx.wait();
    console.log("New vault: setStrategistAddr(deployer)");
  }

  // --- 4. Whitelist Master proxy on the new vault -------------------------
  const dMasterProxy = await deployments.get("MasterWOTokenStrategyProxy");
  if (!(await cNewVault.isMintWhitelistedStrategy(dMasterProxy.address))) {
    const tx = await cNewVault.whitelistStrategy(dMasterProxy.address);
    await tx.wait();
    console.log(`New vault: whitelistStrategy(${dMasterProxy.address})`);
  }

  // --- 5. Deploy Master impl pointing at new vault + new OToken -----------
  const dNewMasterImpl = await deploy("MasterWOTokenStrategyV3", {
    from: deployerAddr,
    contract: "MasterWOTokenStrategy",
    args: [
      {
        platformAddress: ethers.constants.AddressZero,
        vaultAddress: dNewVault.address,
      },
      addresses.baseSepolia.WETH,
      dNewOToken.address,
    ],
    log: true,
  });
  console.log(`MasterWOTokenStrategy impl v3: ${dNewMasterImpl.address}`);

  // --- 6. Upgrade Master proxy to the new impl ----------------------------
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

  // --- 7. Overwrite canonical artifacts so subsequent tasks resolve v3 ----
  await deployments.save("MockOETHbVault", {
    address: dNewVault.address,
    abi: (await deployments.get("MockOETHbVaultV3")).abi,
  });
  await deployments.save("MockOETHb", {
    address: dNewOToken.address,
    abi: (await deployments.get("MockOETHbV3")).abi,
  });
  await deployments.save("MasterWOTokenStrategy", {
    address: dNewMasterImpl.address,
    abi: (await deployments.get("MasterWOTokenStrategyV3")).abi,
  });
  console.log(
    "Canonical artifacts overwritten: MockOETHbVault, MockOETHb, MasterWOTokenStrategy → v3."
  );

  console.log("\n=== Base Sepolia v3 chain summary ===");
  console.log(`  Master proxy:       ${dMasterProxy.address}`);
  console.log(`  Master impl v3:     ${dNewMasterImpl.address}`);
  console.log(`  MockOETHbVault v3:  ${dNewVault.address}`);
  console.log(`  MockOETHb v3:       ${dNewOToken.address}`);
  console.log(`  WETH:               ${addresses.baseSepolia.WETH}`);
  console.log(`  Strategist:         ${deployerAddr}`);
  console.log(
    "Note: any OETHb on the old MockOETHb is orphaned — re-mint via tn:mint-oethb under the v3 OToken."
  );

  return true;
};

module.exports.id = "baseSepolia_005_redeploy_mock_vault";
module.exports.tags = ["baseSepolia"];
module.exports.dependencies = ["baseSepolia_004_wire_master"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "baseSepolia";
};
