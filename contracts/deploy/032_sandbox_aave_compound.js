const addresses = require("../utils/addresses");
const { deploymentWithProposal, withConfirmation } = require("../utils/deploy");
const { getTxOpts } = require("../utils/tx");

module.exports = deploymentWithProposal(
  { deployName: "032_sandbox_aave_compound", forceDeploy: true },
  async ({ ethers, assetAddresses, deployWithConfirmation }) => {
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
    // Initialize Compound strategy proxy
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

    await withConfirmation(
      cCompoundStrategy
        .connect(sDeployer)
        ["initialize(address,address,address,address[],address[])"](
          addresses.dead,
          cVaultProxy.address,
          assetAddresses.COMP,
          [assetAddresses.USDC, assetAddresses.USDT],
          [assetAddresses.cUSDC, assetAddresses.cUSDT]
        )
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
    // Initialize Aave sandbox proxy
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

    const initFunction =
      "initialize(address,address,address,address[],address[],address,address)";
    await withConfirmation(
      cAaveStrategy
        .connect(sDeployer)
        // eslint-disable-next-line
        [initFunction](
          assetAddresses.AAVE_ADDRESS_PROVIDER,
          cVault.address,
          assetAddresses.AAVE,
          [assetAddresses.DAI],
          [assetAddresses.aDAI],
          assetAddresses.AAVE_INCENTIVES_CONTROLLER,
          assetAddresses.STKAAVE
        )
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
          args: [],
        },
        {
          // Claim governance of Aave
          contract: cAaveStrategy,
          signature: "claimGovernance()",
          args: [],
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
