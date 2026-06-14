/**
 * Sepolia testnet (Remote side) — mock OUSD vault + mock OUSD + mock wOUSD
 * for the OUSD V3 testnet stack (parallel to OETHb V3 at scripts 001/002/006).
 *
 * MockEthOTokenVault is generic — works for USDC just as well as WETH. Instant
 * `mint(amount)` (DEPOSIT path) + async `requestWithdrawal`/`claimWithdrawal`
 * (WITHDRAW path) with 0-second claim delay (default).
 *
 * Chicken-and-egg: vault constructor needs OToken address, OToken constructor
 * needs vault address. Solved by predicting the OToken's create address from
 * the deployer nonce — same trick as 001_mock_oeth.js.
 */
const addresses = require("../../utils/addresses");

module.exports = async (hre) => {
  const { ethers, deployments } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await hre.getNamedAccounts();

  console.log(`[sepolia] 010_mock_ousd — deployer=${deployerAddr}`);

  // Sequence: MockOUSDVault at nonce N, MockOUSD at N+1, MockWOUSD at N+2.
  const startNonce = await ethers.provider.getTransactionCount(deployerAddr);
  const predictedOTokenAddr = ethers.utils.getContractAddress({
    from: deployerAddr,
    nonce: startNonce + 1,
  });
  console.log(`Predicted MockOUSD address: ${predictedOTokenAddr}`);

  const dVault = await deploy("MockOUSDVault", {
    from: deployerAddr,
    contract: "MockEthOTokenVault",
    args: [addresses.sepolia.USDC, predictedOTokenAddr],
    log: true,
  });
  console.log(`MockOUSDVault: ${dVault.address}`);

  const dOToken = await deploy("MockOUSD", {
    from: deployerAddr,
    contract: "MockMintableBurnableOToken",
    args: ["Mock OUSD", "mOUSD", dVault.address],
    log: true,
  });
  if (dOToken.address.toLowerCase() !== predictedOTokenAddr.toLowerCase()) {
    throw new Error(
      `MockOUSD address mismatch: predicted ${predictedOTokenAddr}, got ${dOToken.address}`
    );
  }
  console.log(`MockOUSD: ${dOToken.address}`);

  const dWOToken = await deploy("MockWOUSD", {
    from: deployerAddr,
    contract: "MockERC4626Vault",
    args: [dOToken.address],
    log: true,
  });
  console.log(`MockWOUSD (ERC-4626): ${dWOToken.address}`);

  return true;
};

module.exports.id = "sepolia_010_mock_ousd";
module.exports.tags = ["sepolia"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "sepolia";
};
