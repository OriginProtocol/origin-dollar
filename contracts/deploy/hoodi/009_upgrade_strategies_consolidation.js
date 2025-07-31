const {
  upgradeNativeStakingSSVStrategy,
  upgradeCompoundingStakingSSVStrategy,
  deployConsolidationManager
} = require("../deployActions");
const { isFork } = require("../../test/helpers");
const { impersonateAndFund } = require("../../utils/signers");
const { withConfirmation } = require("../../utils/deploy");
const { getDefenderSigner } = require("../../utils/signersNoHardhat");

const mainExport = async () => {
  console.log(
    "Running 009_upgrade_strategies_consolidation deployment on Hoodi..."
  );
  const { deployerAddr } = await getNamedAccounts();
  const sDefender = await getDefenderSigner();

  if (isFork) {
    // Fund the deployer on fork
    impersonateAndFund(deployerAddr, "10000");
  }

  await deployConsolidationManager();
  await upgradeNativeStakingSSVStrategy();
  await upgradeCompoundingStakingSSVStrategy();

  const cConsolidationManager = await ethers.getContractAt(
    "ConsolidationManager",
    (await ethers.getContract("ConsolidationManagerProxy")).address
  );

  const cStakingStrategy = await ethers.getContractAt(
    "NativeStakingSSVStrategy",
    (await ethers.getContract("NativeStakingSSVStrategyProxy")).address
  );

  const cCompoundingStakingStrategy = await ethers.getContractAt(
    "CompoundingStakingSSVStrategy",
    (await ethers.getContract("CompoundingStakingSSVStrategyProxy")).address
  );

  await withConfirmation(
    cConsolidationManager
      .connect(sDefender)
      .addSourceStrategy(cStakingStrategy.address)
  );
  // TODO: for mainnet addSourceStrategy for nativeStakingStrategy proxy2 & proxy3

  await withConfirmation(
    cConsolidationManager
      .connect(sDefender)
      .setTargetStrategy(cCompoundingStakingStrategy.address)
  );

  await withConfirmation(
    cCompoundingStakingStrategy
      .connect(sDefender)
      .setConsolidationContract(cConsolidationManager.address)
  );

  console.log("Running 009 deployment done");
  return true;
};

mainExport.id = "009_upgrade_strategies_consolidation";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
