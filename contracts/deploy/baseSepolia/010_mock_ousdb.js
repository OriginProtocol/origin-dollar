/**
 * Base Sepolia testnet (Master side) — mock OUSDb + mock L2 vault for the
 * OUSD V3 testnet stack (parallel to OETHb V3 at scripts 001–006).
 *
 * Mirrors 001_mock_oethb.js but bridgeAsset = USDC (Circle testnet) instead
 * of WETH. The MockOTokenVault is generic (post-script-005 surface area:
 * mintForStrategy/burnForStrategy + user mint/redeem + setBridgeAsset).
 */
const addresses = require("../../utils/addresses");

module.exports = async (hre) => {
  const { ethers, deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await getNamedAccounts();

  console.log(`[baseSepolia] 010_mock_ousdb — deployer=${deployerAddr}`);

  // Deploy MockOTokenVault first (OToken constructor needs vault address).
  const dVault = await deploy("MockOUSDbVault", {
    from: deployerAddr,
    contract: "MockOTokenVault",
    args: [],
    log: true,
  });
  console.log(`MockOUSDbVault: ${dVault.address}`);

  // Deploy MockMintableBurnableOToken (OUSDb).
  const dOToken = await deploy("MockOUSDb", {
    from: deployerAddr,
    contract: "MockMintableBurnableOToken",
    args: ["Mock OUSDb", "mOUSDb", dVault.address],
    log: true,
  });
  console.log(`MockOUSDb: ${dOToken.address}`);

  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const cVault = await ethers.getContractAt(
    "MockOTokenVault",
    dVault.address,
    sDeployer
  );

  // Wire the vault (idempotent — checks current state before each setter).
  if ((await cVault.oToken()) === ethers.constants.AddressZero) {
    const tx = await cVault.setOToken(dOToken.address);
    await tx.wait();
    console.log("v.setOToken(MockOUSDb)");
  }
  if ((await cVault.bridgeAsset()) === ethers.constants.AddressZero) {
    const tx = await cVault.setBridgeAsset(addresses.baseSepolia.USDC);
    await tx.wait();
    console.log(`v.setBridgeAsset(USDC = ${addresses.baseSepolia.USDC})`);
  }
  if ((await cVault.strategistAddr()) === ethers.constants.AddressZero) {
    const tx = await cVault.setStrategistAddr(deployerAddr);
    await tx.wait();
    console.log(`v.setStrategistAddr(deployer)`);
  }

  return true;
};

module.exports.id = "baseSepolia_010_mock_ousdb";
module.exports.tags = ["baseSepolia"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "baseSepolia";
};
