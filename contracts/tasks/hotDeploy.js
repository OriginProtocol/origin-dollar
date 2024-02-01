const log = require("../utils/logger")("task:hot-deploy");
const { hotDeployVaultAdmin } = require("../test/_hot-deploy")

async function jupyterFixture(taskArguments, hre) {
  await hotDeployVaultAdmin(
    {}, // fixture
    false, // deployVaultAdmin
    true, // deployVaultCore
    true, // isOeth
    true // isJupiterDeploy
  );
}

module.exports = {
  jupyterFixture
};
