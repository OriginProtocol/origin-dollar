/**
 * Sepolia testnet (Remote side) — mock wOETH (ERC-4626 wrapper over MockOETH).
 *
 * Uses the existing MockERC4626Vault. Remote interacts with wOETH for the
 * yield-bearing custody role: `deposit(oETH)` after `mint` on the OETH vault,
 * `withdraw(net)` before unwrapping for cross-chain delivery.
 */
module.exports = async (hre) => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await hre.getNamedAccounts();

  console.log(`[sepolia] 002_mock_woeth — deployer=${deployerAddr}`);

  const dOToken = await deployments.get("MockOETH");
  const dWOToken = await deploy("MockWOETH", {
    from: deployerAddr,
    contract: "MockERC4626Vault",
    args: [dOToken.address],
    log: true,
  });
  console.log(`MockWOETH (ERC-4626): ${dWOToken.address}`);

  return true;
};

module.exports.id = "sepolia_002_mock_woeth";
module.exports.tags = ["sepolia"];
module.exports.dependencies = ["sepolia_001_mock_oeth"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "sepolia";
};
