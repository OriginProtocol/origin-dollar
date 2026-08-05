const { resolveContract } = require("../../utils/resolvers");
const { deployCompoundingStakingSSVStrategy } = require("../deployActions");
const { withConfirmation } = require("../../utils/deploy");
const { getSigner } = require("../../utils/signers");
const addresses = require("../../utils/addresses.js");

const log = require("../../utils/logger")("deploy:hoodi");

const mainExport = async () => {
  console.log("Deploy new compounding staking strategy");
  const sGovernor = await getSigner();

  const compoundingSsvStrategy = await deployCompoundingStakingSSVStrategy();

  const cVault = await resolveContract("OETHVaultProxy", "IVault");

  log("Approving compounding strategy on OETH Vault");
  await withConfirmation(
    cVault.connect(sGovernor).approveStrategy(compoundingSsvStrategy.address)
  );

  log(
    `Setting Registrator on Compounding Strategy to ${addresses.hoodi.validatorRegistrator}`
  );
  await withConfirmation(
    compoundingSsvStrategy
      .connect(sGovernor)
      .setRegistrator(addresses.hoodi.validatorRegistrator)
  );

  console.log("Running 028 deployment done");
  return true;
};

mainExport.id = "028_deploy_new_staking_contracts";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
