const { isCI } = require("../test/helpers");
const addresses = require("../utils/addresses");
const { deployOnArb } = require("../utils/delpoy-l2");
const { deployWithConfirmation, withConfirmation } = require("../utils/deploy");
const { impersonateAndFund } = require("../utils/signers");
const { getTxOpts } = require("../utils/tx");

module.exports = deployOnArb(
  {
    deployName: "086_l2_governance",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();

    const governanceProxy = await ethers.getContract("L2GovernanceProxy");

    let sDeployer = await ethers.provider.getSigner(deployerAddr);
    if (isCI) {
      sDeployer = await impersonateAndFund(await governanceProxy.governor());
    }

    // Deploy L2Governor
    await deployWithConfirmation("L2Governor", [
      [governanceProxy.address], // Only L2Governance can propose
      [governanceProxy.address], // Only L2Governance can execute
    ]);
    const governor = await ethers.getContract("L2Governor");
    console.log("L2Governor deployed: ", governor.address);

    // Deploy L2Governance Implementation
    await deployWithConfirmation("L2Governance", [
      addresses.arbitrumOne.CCIPRouter, // CCIP Router on Arbitrum
    ]);
    const governanceImpl = await ethers.getContract("L2Governance");
    console.log("L2Governance deployed: ", governanceImpl.address);

    // Build initialization data for implementation
    const initData = governanceImpl.interface.encodeFunctionData(
      "initialize(address,address)",
      [
        governor.address, // Timelock/L2Governor
        addresses.mainnet.MainnetGovernanceExecutorProxy,
      ]
    );
    // Initialize Proxy
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      governanceProxy.connect(sDeployer)[initFunction](
        governanceImpl.address,
        // Governor (For proxy upgrades, unused in the implementation)
        // L2Governor (Timelock) can upgrade L2Governance
        governor.address,
        initData, // Implementation initialization
        await getTxOpts()
      )
    );
    console.log("Initialized L2Governance proxy and implementation");
  }
);
