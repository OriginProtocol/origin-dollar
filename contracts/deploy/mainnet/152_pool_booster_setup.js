const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "152_pool_booster_setup",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const oethProxy = await ethers.getContract("OETHProxy");
    const oeth = await ethers.getContractAt("OETH", oethProxy.address);

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Deploy PoolBoostCentralRegistry
    // ---
    // ---------------------------------------------------------------------------------------------------------

    await deployWithConfirmation("PoolBoostCentralRegistryProxy");
    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );

    console.log(
      `Pool boost central registry proxy deployed: ${cPoolBoostCentralRegistryProxy.address}`
    );

    const dPoolBoostCentralRegistry = await deployWithConfirmation(
      "PoolBoostCentralRegistry",
      []
    );
    console.log(
      `Deployed Pool Boost Central Registry to ${dPoolBoostCentralRegistry.address}`
    );

    const cPoolBoostCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      cPoolBoostCentralRegistryProxy.address
    );

    // prettier-ignore
    await withConfirmation(
      cPoolBoostCentralRegistryProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dPoolBoostCentralRegistry.address,
          addresses.mainnet.Timelock,
          "0x"
        )
    );
    console.log(
      "Initialized PoolBoostCentralRegistry proxy and implementation"
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Deploy PoolBoosterFactoryMerkl
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const dPoolBoosterFactoryMerkl = await deployWithConfirmation(
      "PoolBoosterFactoryMerkl",
      [
        oeth.address,
        addresses.mainnet.Timelock,
        cPoolBoostCentralRegistryProxy.address,
        addresses.mainnet.MerklDistributor,
      ]
    );
    const cPoolBoosterMerklFactory = await ethers.getContract(
      "PoolBoosterFactoryMerkl"
    );

    console.log(
      `Pool Booster Merkl Factory deployed to ${cPoolBoosterMerklFactory.address}`
    );
    const salt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Merkl Morpho PB OUSD/USDC v1"));

    return {
      name: "Upgrade PoolBoosterCentralRegistry and deploy PoolBoosterFactoryMerkl",
      actions: [
        {
          // set the factory as an approved one
          contract: cPoolBoostCentralRegistry,
          signature: "approveFactory(address)",
          args: [dPoolBoosterFactoryMerkl.address],
        },
        {
          // set the factory as an approved one
          contract: cPoolBoosterMerklFactory,
          signature: "createPoolBoosterMerkl(uint32,address,uint32,bytes,uint256)",
          args: [
            45, // campaignType: MORPHOBORROW meaning we incentivise the borrowing side: lowering USDC borrow rate
            addresses.mainnet.MorphoOusdUsdcMarket.substring(0, 42), // trimmed market address for tracking purposes
            60 * 60 * 24 * 7, // campaing duration: 7 days
            // Built in the UI following these steps: 
            // - https://www.notion.so/originprotocol/How-to-Borrow-Booster-27e84d46f53c80d4b657ca2fc3f6554b
            // - "https://www.dropbox.com/scl/fi/gtkgwmvnfjrovzhbjg417/Screenshot-2025-10-02-at-10.24.33.png?rlkey=oyqhmex7wrvxzps3h8dmr6g1l&dl=0",
            "0xb8fef900b383db2dbbf4458c7f46acf5b140f26d603a6d1829963f241b82510e00000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
            salt// salt

          ],
        }
      ],
    };
  }
);
