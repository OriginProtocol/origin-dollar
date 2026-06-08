/**
 * Sepolia testnet (Remote side) — mock OETH + mock OETH vault.
 *
 * MockEthOTokenVault stands in for the Ethereum-side OETH vault. Remote
 * interacts with it for: instant `mint(amount)` (DEPOSIT path); async
 * `requestWithdrawal(amount) → claimWithdrawal(id)` (WITHDRAW path). The
 * mock supports both. `bridgeAsset` is Sepolia WETH; `oToken` is the mock
 * we deploy here.
 */
const addresses = require("../../utils/addresses");

module.exports = async (hre) => {
  const { ethers, deployments } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await hre.getNamedAccounts();

  console.log(`[sepolia] 001_mock_oeth — deployer=${deployerAddr}`);

  // The Eth-side mock vault constructor requires the OToken address but the
  // OToken constructor requires the vault address. Resolve by using a
  // two-step: deploy a "compute predicted vault address" approach is messy;
  // simpler — accept that mock storage of `bridgeAsset` + `oToken` is fixed
  // at constructor time. We deploy OToken first with a placeholder vault
  // (a fresh EOA-style address), then deploy the real MockEthOTokenVault
  // pointing at that OToken, then redeploy a fresh OToken whose vault is
  // the real one.
  //
  // Actually the simpler pattern (used by the V3 tests): MockMintableBurnableOToken
  // has `vaultAddress` immutable. So we must know the vault address before
  // deploying the OToken. We can compute the next CREATE address from
  // (deployerAddr, nonce) but that's brittle.
  //
  // Cleanest pattern: deploy a temp deployer-controlled OToken vault stub
  // first, then deploy the real OToken bound to it, then deploy the real
  // MockEthOTokenVault using the OToken. The MockEthOTokenVault has no
  // mint/burn auth check — it just calls oToken.mint, which only the
  // OToken's vaultAddress can do. So we set the OToken's vault to the
  // MockEthOTokenVault address.
  //
  // To resolve the chicken-and-egg without a separate predictor:
  //   1. Deploy MockOTokenVault first (just to get an address).
  //   2. Deploy MockMintableBurnableOToken pointing at it.
  //   3. Deploy MockEthOTokenVault with the OToken address, and that becomes
  //      the "vault" address that mint/burn calls go through. The OToken's
  //      `vaultAddress` is fixed at the MockOTokenVault address from step 1
  //      — but it's not what mint() will be called from. To square this we
  //      use MockOTokenVault as the AUTHORISED vault and have the
  //      MockEthOTokenVault forward mint/burn through it.
  //
  // Simpler still: deploy the MockEthOTokenVault FIRST as `vaultAddress`,
  // then deploy the OToken bound to it. MockEthOTokenVault's constructor
  // accepts the OToken in its constructor though. So we still have a cycle.
  //
  // Pragmatic resolution for testnet: deploy a tiny helper "MockOETHHolder"
  // would be over-engineering. Instead, predict the OToken address via
  // ethers `getContractAddress({ from, nonce })` and pass that into the
  // vault constructor. Both are deployer-deploys so nonce is sequential.
  const startNonce = await ethers.provider.getTransactionCount(deployerAddr);
  // Step 1 will deploy the vault at nonce `startNonce`.
  // Step 2 will deploy the OToken at nonce `startNonce + 1`.
  const predictedOTokenAddr = ethers.utils.getContractAddress({
    from: deployerAddr,
    nonce: startNonce + 1,
  });
  console.log(`Predicted MockOETH address: ${predictedOTokenAddr}`);

  // --- 1. Deploy MockEthOTokenVault with the predicted OToken address ---
  const dVault = await deploy("MockOETHVault", {
    from: deployerAddr,
    contract: "MockEthOTokenVault",
    args: [addresses.sepolia.WETH, predictedOTokenAddr],
    log: true,
  });
  console.log(`MockOETHVault: ${dVault.address}`);

  // --- 2. Deploy MockMintableBurnableOToken pointing at the vault ---
  const dOToken = await deploy("MockOETH", {
    from: deployerAddr,
    contract: "MockMintableBurnableOToken",
    args: ["Mock OETH", "mOETH", dVault.address],
    log: true,
  });
  if (dOToken.address.toLowerCase() !== predictedOTokenAddr.toLowerCase()) {
    throw new Error(
      `MockOETH address mismatch: predicted ${predictedOTokenAddr}, got ${dOToken.address}`
    );
  }
  console.log(`MockOETH: ${dOToken.address}`);

  // Withdrawal claim delay defaults to 0 — fine for testnet smoke tests.
  // For more realistic flows, operator can call setWithdrawalClaimDelay later.

  return true;
};

module.exports.id = "sepolia_001_mock_oeth";
module.exports.tags = ["sepolia"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "sepolia";
};
