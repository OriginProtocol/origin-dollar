const {
  deployWithConfirmation,
  deploymentWithProposal,
  withConfirmation,
} = require("../utils/deploy");
const { getTxOpts } = require("../utils/tx");

module.exports = deploymentWithProposal(
  { deployName: "032_sandbox_aave_compound", forceDeploy: false },
  async ({ ethers, assetAddresses }) => {
    const { governorAddr, deployerAddr } = await hre.getNamedAccounts();

    // Signers
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

    await deployWithConfirmation(
      "CompoundStrategySandboxProxy",
      null,
      "CompoundStrategyProxy"
    );
    const cCompoundStrategySandboxProxy = await ethers.getContract(
      "CompoundStrategySandboxProxy"
    );
    const cCompoundStrategyProxy = await ethers.getContract(
      "CompoundStrategyProxy"
    );
    const cCompoundStrategyImpl = await ethers.getContract("CompoundStrategy");
    await withConfirmation(
      cCompoundStrategySandboxProxy["initialize(address,address,bytes)"](
        cCompoundStrategyImpl.address,
        deployerAddr,
        []
      )
    );
    const cCompoundStrategy = await ethers.getContractAt(
      "CompoundStrategy",
      cCompoundStrategySandboxProxy.address
    );

    // Transfer governance of Compound strategy to governor
    await withConfirmation(
      cCompoundStrategy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    await deployWithConfirmation(
      "AaveStrategySandboxProxy",
      null,
      "AaveStrategyProxy"
    );
    const cAaveStrategySandboxProxy = await ethers.getContract(
      "AaveStrategySandboxProxy"
    );
    const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
    const cAaveStrategyImpl = await ethers.getContract("AaveStrategy");
    await withConfirmation(
      cAaveStrategySandboxProxy["initialize(address,address,bytes)"](
        cAaveStrategyImpl.address,
        deployerAddr,
        []
      )
    );
    const cAaveStrategy = await ethers.getContractAt(
      "AaveStrategy",
      cAaveStrategySandboxProxy.address
    );

    await withConfirmation(
      cAaveStrategy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    return {
      name: "Add sandbox AAVE and Compound strategies and transfer funds",
      actions: [
        {
          // Claim governance of Compound
          contract: cCompoundStrategy,
          signature: "claimGovernance()",
        },
        {
          // Claim governance of Aave
          contract: cCompoundStrategy,
          signature: "claimGovernance()",
        },
        {
          // Add Compound sandbox
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cCompoundStrategySandboxProxy.address],
        },
        {
          // Add AAVE sandbox
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cAaveStrategySandboxProxy.address],
        },
        {
          // Move 12 million DAI from Aave to Aave sandbox
          contract: cVault,
          signature: "reallocate(address,address,address[],uint256[])",
          args: [
            cCompoundStrategyProxy.address, // from
            cCompoundStrategySandboxProxy.address, // to
            [assetAddresses.USDT, assetAddresses.USDC], // assets
            [8000000 * 1e6, 20000000 * 1e6], // amounts
          ],
        },
        {
          // Move 12 million DAI from Aave to Aave sandbox
          contract: cVault,
          signature: "reallocate(address,address,address[],uint256[])",
          args: [
            cAaveStrategyProxy.address, // from
            cAaveStrategySandboxProxy.address, // to
            [assetAddresses.DAI], // assets
            [ethers.utils.parseEther("1200000")], // amounts
          ],
        },
      ],
    };
  }
);
