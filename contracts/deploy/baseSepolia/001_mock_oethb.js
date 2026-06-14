/**
 * Base Sepolia testnet (Master side) — mock OETHb + mock L2 vault.
 *
 * Stands in for the production OETHb / OETHBaseVault on Base. The Master
 * strategy's only interaction with the vault is `mintForStrategy` /
 * `burnForStrategy` (bridge channel) and `Withdrawal` events; the mock
 * implements just that surface area.
 */
module.exports = async (hre) => {
  const { ethers, deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await getNamedAccounts();

  console.log(`[baseSepolia] 001_mock_oethb — deployer=${deployerAddr}`);

  // Deploy MockOTokenVault first (OToken constructor needs vault address).
  const dVault = await deploy("MockOETHbVault", {
    from: deployerAddr,
    contract: "MockOTokenVault",
    args: [],
    log: true,
  });
  console.log(`MockOETHbVault: ${dVault.address}`);

  // Deploy MockMintableBurnableOToken (OETHb).
  const dOToken = await deploy("MockOETHb", {
    from: deployerAddr,
    contract: "MockMintableBurnableOToken",
    args: ["Mock OETHb", "mOETHb", dVault.address],
    log: true,
  });
  console.log(`MockOETHb: ${dOToken.address}`);

  // Wire the vault to the OToken (one-time setup; mock has no access control).
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const cVault = await ethers.getContractAt(
    "MockOTokenVault",
    dVault.address,
    sDeployer
  );
  const currentOToken = await cVault.oToken();
  if (currentOToken === ethers.constants.AddressZero) {
    const tx = await cVault.setOToken(dOToken.address);
    await tx.wait();
    console.log("Wired vault.oToken = MockOETHb");
  } else {
    console.log(`Vault already wired (oToken=${currentOToken})`);
  }

  return true;
};

module.exports.id = "baseSepolia_001_mock_oethb";
module.exports.tags = ["baseSepolia"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "baseSepolia";
};
