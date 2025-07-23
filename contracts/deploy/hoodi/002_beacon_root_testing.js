const {
  deployWithConfirmation
} = require("../../utils/deploy");

const mainExport = async () => {
  const dMockBeaconRoots = await deployWithConfirmation("MockBeaconRoots");
  console.log(`Deployed MockBeaconRoots ${dMockBeaconRoots.address}`);
  return true;
};

mainExport.id = "002_beacon_root_testing";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
