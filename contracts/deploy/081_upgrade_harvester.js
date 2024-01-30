const {
  deploymentWithGovernanceProposal,
  withConfirmation,
} = require("../utils/deploy");
const addresses = require("../utils/addresses");
const { oethUnits } = require("../test/helpers");
const { utils } = require("ethers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "081_upgrade_harvester",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    executeGasLimit: 30000000,
    proposalId:
      "70744121595007528818249644545963691097758184661168820806929451960448344720141",
  },
  async ({ deployWithConfirmation, ethers, getTxOpts }) => {
    const { timelockAddr } = await getNamedAccounts();

    // Current contracts
    const cOUSDVaultProxy = await ethers.getContract("VaultProxy");
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOUSDVault = await ethers.getContractAt(
      "IVault",
      cOUSDVaultProxy.address
    );
    const cOETHVault = await ethers.getContractAt(
      "IVault",
      cOETHVaultProxy.address
    );
    const cOUSDHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
    const cOUSDHarvester = await ethers.getContractAt(
      "Harvester",
      cOUSDHarvesterProxy.address
    );
    const cOETHHarvester = await ethers.getContractAt(
      "OETHHarvester",
      cOETHHarvesterProxy.address
    );

    const cOETHDripperProxy = await ethers.getContract("OETHDripperProxy");
    const cOETHDripper = await ethers.getContractAt(
      "OETHDripper",
      cOETHDripperProxy.address
    );

    // Deployer Actions
    // ----------------

    // 1. Deploy Aura Price feed
    await deployWithConfirmation("AuraWETHPriceFeed", [
      addresses.mainnet.AuraWeightedOraclePool,
      timelockAddr,
    ]);
    const auraPriceFeed = await ethers.getContract("AuraWETHPriceFeed");
    console.log("AuraWETHPriceFeed address: ", auraPriceFeed.address);

    // 2. Deploy OETHOracleRouter
    await deployWithConfirmation("OETHOracleRouter", [auraPriceFeed.address]);
    const dOETHRouter = await ethers.getContract("OETHOracleRouter");
    console.log("new OETHOracleRouter address: ", dOETHRouter.address);

    // 2.1. Cache decimals on OETHOracleRouter
    for (const asset of [
      addresses.mainnet.CRV,
      addresses.mainnet.CVX,
      addresses.mainnet.AURA,
      addresses.mainnet.BAL,
      addresses.mainnet.stETH,
      addresses.mainnet.rETH,
      addresses.mainnet.frxETH,
    ]) {
      await withConfirmation(
        dOETHRouter.cacheDecimals(asset, await getTxOpts())
      );
    }
    const dOUSDRouter = await ethers.getContract("OracleRouter");
    await withConfirmation(
      dOUSDRouter.cacheDecimals(addresses.mainnet.Aave, await getTxOpts())
    );

    // 3. Deploy Harvester
    await deployWithConfirmation(
      "Harvester",
      [cOUSDVault.address, addresses.mainnet.USDT],
      undefined,
      true
    );
    const dHarvesterImpl = await ethers.getContract("Harvester");
    console.log(
      "New Harvester implementation address: ",
      dHarvesterImpl.address
    );

    // 4. Deploy OETHHarvester
    await deployWithConfirmation(
      "OETHHarvester",
      [cOETHVault.address, addresses.mainnet.WETH],
      undefined,
      true
    );
    const dOETHHarvesterImpl = await ethers.getContract("OETHHarvester");
    console.log(
      "New OETHHarvester implementation address: ",
      dOETHHarvesterImpl.address
    );

    const setRewardTokenConfigSig =
      "setRewardTokenConfig(address,(uint16,uint16,address,bool,uint8,uint256),bytes)";

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade Harvester contracts",
      actions: [
        // 1. Upgrade OETH Harvester
        {
          contract: cOETHHarvesterProxy,
          signature: "upgradeTo(address)",
          args: [dOETHHarvesterImpl.address],
        },
        // 2. Upgrade OUSD Harvester
        {
          contract: cOUSDHarvesterProxy,
          signature: "upgradeTo(address)",
          args: [dHarvesterImpl.address],
        },
        // 3. Set OETH Oracle Router on Vault
        {
          contract: cOETHVault,
          signature: "setPriceProvider(address)",
          args: [dOETHRouter.address],
        },
        // 4. Configure OETH Harvester to swap CRV with Curve
        {
          contract: cOETHHarvester,
          signature: setRewardTokenConfigSig,
          args: [
            addresses.mainnet.CRV,
            {
              allowedSlippageBps: 300,
              harvestRewardBps: 200,
              swapPlatform: 3, // Curve
              swapPlatformAddr: addresses.mainnet.CurveTriPool,
              liquidationLimit: oethUnits("4000"),
              doSwapRewardToken: true,
            },
            utils.defaultAbiCoder.encode(["uint128", "uint128"], ["2", "1"]),
          ],
        },
        // 5. Configure OETH Harvester to swap BAL with Balancer
        {
          contract: cOETHHarvester,
          signature: setRewardTokenConfigSig,
          args: [
            addresses.mainnet.BAL,
            {
              allowedSlippageBps: 300,
              harvestRewardBps: 200,
              swapPlatform: 2, // Balancer
              swapPlatformAddr: addresses.mainnet.balancerVault,
              liquidationLimit: oethUnits("1000"),
              doSwapRewardToken: true,
            },
            utils.defaultAbiCoder.encode(
              ["bytes32"],
              [
                "0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014",
              ]
            ),
          ],
        },
        // 6. Configure OETH Harvester to swap AURA with Balancer
        {
          contract: cOETHHarvester,
          signature: setRewardTokenConfigSig,
          args: [
            addresses.mainnet.AURA,
            {
              allowedSlippageBps: 300,
              harvestRewardBps: 200,
              swapPlatform: 2, // Balancer
              swapPlatformAddr: addresses.mainnet.balancerVault,
              liquidationLimit: oethUnits("4000"),
              doSwapRewardToken: true,
            },
            utils.defaultAbiCoder.encode(
              ["bytes32"],
              [
                "0xcfca23ca9ca720b6e98e3eb9b6aa0ffc4a5c08b9000200000000000000000274",
              ]
            ),
          ],
        },
        // 7. Configure OETH Harvester to swap CVX with Curve
        {
          contract: cOETHHarvester,
          signature: setRewardTokenConfigSig,
          args: [
            addresses.mainnet.CVX,
            {
              allowedSlippageBps: 300,
              harvestRewardBps: 200,
              swapPlatform: 3, // Curve
              swapPlatformAddr: addresses.mainnet.CurveCVXPool,
              liquidationLimit: oethUnits("2500"),
              doSwapRewardToken: true,
            },
            utils.defaultAbiCoder.encode(["uint128", "uint128"], ["1", "0"]),
          ],
        },
        // 8. Configure OUSD Harvester to swap CRV with Uniswap V3
        {
          contract: cOUSDHarvester,
          signature: setRewardTokenConfigSig,
          args: [
            addresses.mainnet.CRV,
            {
              allowedSlippageBps: 300,
              harvestRewardBps: 200,
              swapPlatform: 1, // Uniswap V3
              swapPlatformAddr: addresses.mainnet.uniswapV3Router,
              liquidationLimit: oethUnits("4000"),
              doSwapRewardToken: true,
            },
            utils.solidityPack(
              ["address", "uint24", "address", "uint24", "address"],
              [
                addresses.mainnet.CRV,
                3000,
                addresses.mainnet.WETH,
                500,
                addresses.mainnet.USDT,
              ]
            ),
          ],
        },
        // 9. Configure OUSD Harvester to swap CVX with Uniswap V3
        {
          contract: cOUSDHarvester,
          signature: setRewardTokenConfigSig,
          args: [
            addresses.mainnet.CVX,
            {
              allowedSlippageBps: 300,
              harvestRewardBps: 100,
              swapPlatform: 1, // Uniswap V3
              swapPlatformAddr: addresses.mainnet.uniswapV3Router,
              liquidationLimit: oethUnits("2500"),
              doSwapRewardToken: true,
            },
            utils.solidityPack(
              ["address", "uint24", "address", "uint24", "address"],
              [
                addresses.mainnet.CVX,
                10000,
                addresses.mainnet.WETH,
                500,
                addresses.mainnet.USDT,
              ]
            ),
          ],
        },
        // 10. Configure OUSD Harvester to swap COMP with Uniswap V3
        {
          contract: cOUSDHarvester,
          signature: setRewardTokenConfigSig,
          args: [
            addresses.mainnet.COMP,
            {
              allowedSlippageBps: 300,
              harvestRewardBps: 100,
              swapPlatform: 1, // Uniswap V3
              swapPlatformAddr: addresses.mainnet.uniswapV3Router,
              liquidationLimit: 0,
              doSwapRewardToken: true,
            },
            utils.solidityPack(
              ["address", "uint24", "address", "uint24", "address"],
              [
                addresses.mainnet.COMP,
                3000,
                addresses.mainnet.WETH,
                500,
                addresses.mainnet.USDT,
              ]
            ),
          ],
        },
        // 11. Configure OUSD Harvester to swap AAVE with Uniswap V3
        {
          contract: cOUSDHarvester,
          signature: setRewardTokenConfigSig,
          args: [
            addresses.mainnet.Aave,
            {
              allowedSlippageBps: 300,
              harvestRewardBps: 100,
              swapPlatform: 1, // Uniswap V3
              swapPlatformAddr: addresses.mainnet.uniswapV3Router,
              liquidationLimit: 0,
              doSwapRewardToken: true,
            },
            utils.solidityPack(
              ["address", "uint24", "address", "uint24", "address"],
              [
                addresses.mainnet.Aave,
                10000,
                addresses.mainnet.WETH,
                500,
                addresses.mainnet.USDT,
              ]
            ),
          ],
        },
        // 12. Change Drip duration to 14 days for OETH Dripper
        {
          contract: cOETHDripper,
          signature: "setDripDuration(uint256)",
          args: [14 * 24 * 60 * 60], // 14 days
        },
      ],
    };
  }
);
