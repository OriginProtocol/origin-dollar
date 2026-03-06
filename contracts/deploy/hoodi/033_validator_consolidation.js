const {
  upgradeCompoundingStakingSSVStrategy,
  upgradeNativeStakingSSVStrategy,
} = require("../deployActions");
const { deployWithConfirmation } = require("../../utils/deploy");
const { getDefenderSigner, getSigner } = require("../../utils/signers");
const { isFork } = require("../../test/helpers.js");
const { resolveContract } = require("../../utils/resolvers");

const mainExport = async () => {
  const sDeployer = isFork ? await getSigner() : await getDefenderSigner();
  const deployerAddress = await sDeployer.getAddress();

  // 1. Upgrade the Native Staking Strategy
  await upgradeNativeStakingSSVStrategy();

  const nativeStakingStrategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  // 2. Upgrade the Compounding Staking Strategy
  await upgradeCompoundingStakingSSVStrategy();

  const compoundingStakingStrategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  // 3. Deploy the new Consolidation Controller
  console.log(`Deploy ConsolidationController`);
  const dConsolidationController = await deployWithConfirmation(
    "ConsolidationController",
    [
      deployerAddress, // Owner
      deployerAddress, // Validator Registrator
      nativeStakingStrategy.address, // Old Native Staking Strategy 2
      nativeStakingStrategy.address, // Old Native Staking Strategy 3
      compoundingStakingStrategy.address, // New Compounding Staking Strategy
    ]
  );

  // 4. Set the Registrator of the Compounding Staking Strategy to the Consolidation Controller
  console.log(
    `About to set Registrator of CompoundingStakingSSVStrategy to ConsolidationController`
  );
  await compoundingStakingStrategy
    .connect(sDeployer)
    .setRegistrator(dConsolidationController.address);

  // 5. Set the Registrator of the Native Staking Strategy to the Consolidation Controller
  console.log(
    `About to set Registrator of NativeStakingSSVStrategy to ConsolidationController`
  );
  await nativeStakingStrategy
    .connect(sDeployer)
    .setRegistrator(dConsolidationController.address);

  console.log("Running 033 deployment done");
  return true;
};

mainExport.id = "033_validator_consolidation";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
