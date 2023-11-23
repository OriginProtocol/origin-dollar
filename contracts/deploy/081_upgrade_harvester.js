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
    deployerIsProposer: true,
    executeGasLimit: 30000000,
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
              platform: 3, // Curve
              swapRouterAddr: "0x4ebdf703948ddcea3b11f675b4d1fba9d2414a14",
              liquidationLimit: oethUnits("4000"),
              doSwapRewardToken: true,
            },
            utils.defaultAbiCoder.encode(["uint256", "uint256"], ["2", "1"]),
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
              platform: 2, // Balancer
              swapRouterAddr: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
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
              platform: 2, // Balancer
              swapRouterAddr: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
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
              platform: 3, // Curve
              swapRouterAddr: "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4",
              liquidationLimit: oethUnits("2500"),
              doSwapRewardToken: true,
            },
            utils.defaultAbiCoder.encode(["uint256", "uint256"], ["1", "0"]),
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
              platform: 1, // Uniswap V3
              swapRouterAddr: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
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
              platform: 1, // Uniswap V3
              swapRouterAddr: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
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
              platform: 1, // Uniswap V3
              swapRouterAddr: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
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
              platform: 1, // Uniswap V3
              swapRouterAddr: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
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
      ],
    };
  }
);
