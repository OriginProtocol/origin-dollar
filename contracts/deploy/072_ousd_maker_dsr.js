const addresses = require("../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "072_ousd_maker_dsr",
    forceDeploy: false,
    // forceSkip: true,
    // reduceQueueTime: true,
    deployerIsProposer: true,
    proposalId:
      "86061306850762468801715667296603291547349762903757061137093406662425139364009",
  },
  async ({ deployWithConfirmation, getTxOpts, withConfirmation }) => {
    // Current OUSD Vault contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    // Deployer Actions
    // ----------------
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // 1. Deploy new Maker DSR Strategy proxy
    const dMakerDsrProxy = await deployWithConfirmation(
      "MakerDsrStrategyProxy"
    );
    const cMakerDsrProxy = await ethers.getContract("MakerDsrStrategyProxy");

    // 2. Deploy new Generalized4626Strategy contract as there has been a number of gas optimizations since it was first deployed
    const dMakerDsrStrategyImpl = await deployWithConfirmation(
      "Generalized4626Strategy",
      [[addresses.mainnet.sDAI, cVaultProxy.address], addresses.mainnet.DAI],
      undefined,
      true // storage slots have changed since FRAX strategy deployment so force a new deployment
    );
    const cMakerDsr = await ethers.getContractAt(
      "Generalized4626Strategy",
      dMakerDsrProxy.address
    );

    // 3. Construct initialize call data to initialize and configure the new strategy
    const initData = cMakerDsr.interface.encodeFunctionData("initialize()", []);

    // 4. Init the proxy to point at the implementation, set the governor, and call initialize
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cMakerDsrProxy.connect(sDeployer)[initFunction](
        dMakerDsrStrategyImpl.address,
        addresses.mainnet.Timelock, // governor
        initData, // data for delegate call to the initialize function on the strategy
        await getTxOpts()
      )
    );

    // Governance Actions
    // ----------------
    return {
      name: "Add Maker DSR Strategy to the OUSD Vault",
      actions: [
        {
          // Add the new strategy to the vault
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cMakerDsr.address],
        },
        {
          // Add the new strategy to the Harvester
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cMakerDsr.address, true],
        },
        {
          // Set the Harvester in the new strategy
          contract: cMakerDsr,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);
