const addresses = require("../utils/addresses");
const { convex_Try_LSD_PID } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const { getTxOpts } = require("../utils/tx");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "084_trylsd",
    forceDeploy: false,
    forceSkip: false,
    reduceQueueTime: true,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ ethers, deployWithConfirmation, withConfirmation }) => {
    const { deployerAddr, timelockAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Connect to the OETH Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);

    // 2. Deploy new Convex Crypto Strategy for the Curve tryLSD pool
    // Deploy proxy
    const dProxy = await deployWithConfirmation("ConvexTryLSDStrategyProxy");
    const cProxy = await ethers.getContract("ConvexTryLSDStrategyProxy");

    console.log(
      `constructor args ${[
        [addresses.mainnet.CurveTryLSDPool, addresses.mainnet.OETHVaultProxy],
        [
          3, //assets in the Curve pool
          addresses.mainnet.CurveTryLSDPool, // Curve pool
          addresses.mainnet.CurveTryLSDPool, // Curve LP token
        ],
        [addresses.mainnet.CVXBooster, convex_Try_LSD_PID],
        [
          addresses.mainnet.stETH,
          addresses.mainnet.wstETH,
          addresses.mainnet.frxETH,
          addresses.mainnet.sfrxETH,
          [
            // vaultAssetAddresses
            addresses.mainnet.stETH,
            addresses.mainnet.rETH,
            addresses.mainnet.frxETH,
          ],
        ],
      ]}`
    );

    // Deploy and set the immutable variables of implementation
    const dStrategy = await deployWithConfirmation("ConvexCryptoStrategy", [
      [addresses.mainnet.CurveTryLSDPool, addresses.mainnet.OETHVaultProxy],
      [
        3, //assets in the Curve pool
        addresses.mainnet.CurveTryLSDPool, // Curve pool
        addresses.mainnet.CurveTryLSDPool, // Curve LP token
      ],
      [addresses.mainnet.CVXBooster, convex_Try_LSD_PID],
      [
        addresses.mainnet.stETH,
        addresses.mainnet.wstETH,
        addresses.mainnet.frxETH,
        addresses.mainnet.sfrxETH,
        [
          // vaultAssetAddresses
          addresses.mainnet.stETH,
          addresses.mainnet.rETH,
          addresses.mainnet.frxETH,
        ],
      ],
    ]);

    const cStrategy = await ethers.getContractAt(
      "ConvexCryptoStrategy",
      dProxy.address
    );

    // 3. Initialize the new strategy
    // Construct initialize call data to init and configure the new strategy
    const initData = cStrategy.interface.encodeFunctionData(
      "initialize(address[],address[],address[])",
      [
        [addresses.mainnet.CRV, addresses.mainnet.CVX],
        [
          addresses.mainnet.stETH,
          addresses.mainnet.rETH,
          addresses.mainnet.frxETH,
        ],
        [
          addresses.mainnet.CurveTryLSDPool,
          addresses.mainnet.CurveTryLSDPool,
          addresses.mainnet.CurveTryLSDPool,
        ],
      ]
    );

    // prettier-ignore
    await withConfirmation(
        cProxy
              .connect(sDeployer)["initialize(address,address,bytes)"](
                dStrategy.address,
                timelockAddr,
                initData,
                await getTxOpts()
              )
          );
    console.log("Initialized Curve TryLSD Strategy");

    const cHarvester = await ethers.getContractAt(
      "OETHHarvester",
      addresses.mainnet.OETHHarvesterProxy
    );

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new Convex Crypto Strategy for Curve TryLSD pool.",
      actions: [
        // 1. Approve the new strategy in the OETH Vault
        {
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cStrategy.address],
        },
        // 2. Add the new strategy to the OETH Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cStrategy.address, true],
        },
        // 3. Set the harvester address on the new strategy
        {
          contract: cStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvester.address],
        },
      ],
    };
  }
);
