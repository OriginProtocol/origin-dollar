const addresses = require("../../utils/addresses.js");
const hre = require("hardhat");
const {
  getAssetAddresses,
  isFork,
  oethUnits,
  isBaseFork,
} = require("../../test/helpers.js");
const { deployOnBaseWithGuardian } = require("../../utils/delpoy-l2.js");
const { isBaseForkTest } = require("../../utils/hardhat-helpers.js");
const { hardhatSetBalance } = require("../../test/_fund.js");
const { impersonateAndFund } = require("../../utils/signers.js");
const { BigNumber } = require("ethers");

// 5/8 multisig
const guardianAddr = addresses.base.governor;

module.exports = deployOnBaseWithGuardian(
  { deployName: "003_deploy_aero_strategy" },
  async ({ deployWithConfirmation, ethers, withConfirmation }) => {
    let actions = [];
    const { deployerAddr } = await getNamedAccounts();
    const oethVaultProxy = await ethers.getContract("OETHVaultProxy");
    const oethProxy = await ethers.getContract("OETHProxy");
    const oeth = await ethers.getContractAt("OETH", oethProxy.address);
    const weth = await ethers.getContractAt(
      "IWETH9",
      addresses.base.wethTokenAddress
    );
    if (isFork) {
      await hardhatSetBalance(deployerAddr);
      await hardhatSetBalance(guardianAddr);
      if (isBaseForkTest || isBaseFork) {
        const signers = await hre.ethers.getSigners();
        // eslint-disable-next-line no-unused-vars
        const [minter, burner, josh, rafael, nick] = signers.slice(4); // Skip first 4 addresses to avoid conflict
        const vaultSigner = await impersonateAndFund(oethVaultProxy.address);

        await oeth.connect(vaultSigner).mint(josh.address, oethUnits("250"));
        await weth.connect(josh).deposit({ value: oethUnits("350") });

        // Loading the AeroRouter instance
        const aeroRouter = await ethers.getContractAt(
          "IRouter",
          addresses.base.aeroRouterAddress
        );
        // Approve the router to spend the tokens
        await weth.connect(josh).approve(aeroRouter.address, oethUnits("250"));
        await oeth.connect(josh).approve(aeroRouter.address, oethUnits("250"));

        // Add initial liquidity (250 on each side)
        await aeroRouter.connect(josh).addLiquidity(
          weth.address,
          oeth.address,
          true,
          oethUnits("250"),
          oethUnits("250"),
          // Slippage adjusted
          oethUnits("250"),
          oethUnits("250"),
          josh.address,
          parseInt(Date.now() / 1000)
        );

        let poolAddress = await aeroRouter.poolFor(
          weth.address,
          oeth.address,
          true,
          addresses.base.aeroFactoryAddress
        );

        console.log(`OETH pool created on Aerodrome: ${poolAddress}`);

        // Create gauge
        const aeroVoter = await ethers.getContractAt(
          "IVoter",
          addresses.base.aeroVoterAddress
        );
        // Create gauge for weth/oeth LP
        let governor = await impersonateAndFund(
          addresses.base.aeroGaugeGovernorAddress
        );

        await aeroVoter
          .connect(governor)
          .createGauge(addresses.base.aeroFactoryAddress, poolAddress);

        const gaugeAddress = await aeroVoter.gauges(poolAddress);
        console.log(
          `Gauge created for weth/oeth pool at address: ${gaugeAddress}`
        );
      }
    }

    console.log("Deploying Aerodrome Strategy");
    actions = await deployAerodromeStrategy({
      deployWithConfirmation,
      withConfirmation,
      ethers,
    });

    return {
      name: "Deploy Aerodrome strategy",
      actions,
    };
  }
);

/**
 * Deploy the core contracts (Vault and OETH).
 */
const deployAerodromeStrategy = async ({
  deployWithConfirmation,
  withConfirmation,
  ethers,
}) => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr } = await getNamedAccounts();

  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const oethVaultProxy = await ethers.getContract("OETHVaultProxy");
  const oethVault = await ethers.getContractAt(
    "IVault",
    oethVaultProxy.address
  );

  const oeth = await ethers.getContract("OETHProxy");

  console.log("Deploy AerodromeEthStrategyProxy");

  await deployWithConfirmation("AerodromeEthStrategyProxy");

  const cAerodromeEthStrategyProxy = await ethers.getContract(
    "AerodromeEthStrategyProxy"
  );
  // Loading the AeroRouter instance
  const aeroRouter = await ethers.getContractAt(
    "IRouter",
    addresses.base.aeroRouterAddress
  );
  let poolAddress = await aeroRouter.poolFor(
    assetAddresses.WETH,
    oeth.address,
    true,
    addresses.base.aeroFactoryAddress
  );
  // Fetch Gauge address
  const cAeroVoter = await ethers.getContractAt(
    "IVoter",
    addresses.base.aeroVoterAddress
  );

  const gaugeAddress = await cAeroVoter.gauges(poolAddress);

  console.log("Deploy AerodromeEthStrategy");
  const dStrategyImpl = await deployWithConfirmation("AerodromeEthStrategy", [
    [poolAddress, oethVault.address],
    [
      addresses.base.aeroRouterAddress,
      gaugeAddress,
      addresses.base.aeroFactoryAddress,
      poolAddress,
      oeth.address,
      assetAddresses.WETH,
    ],
  ]);
  const cStrategyImpl = await ethers.getContractAt(
    "AerodromeEthStrategy",
    dStrategyImpl.address
  );

  console.log("Deploy encode initialize function of the strategy contract");
  const initData = cStrategyImpl.interface.encodeFunctionData(
    "initialize(address[],address[])",
    [
      [assetAddresses.AERO], // reward token addresses
      [assetAddresses.WETH], // asset token addresses
    ]
  );

  console.log(
    "Initialize the proxy and execute the initialize strategy function"
  );
  await withConfirmation(
    cAerodromeEthStrategyProxy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address,address,bytes)"
    ](
      cStrategyImpl.address, // implementation address
      deployerAddr,
      initData // data for call to the initialize function on the strategy
    )
  );

  await withConfirmation(
    cAerodromeEthStrategyProxy
      .connect(sDeployer)
      .transferGovernance(guardianAddr)
  );

  console.log("Set harvester address");
  const cStrategy = await ethers.getContractAt(
    "AerodromeEthStrategy",
    cAerodromeEthStrategyProxy.address
  );
  const cHarvester = await ethers.getContract("OETHBaseHarvesterProxy");
  const fiftyMil = BigNumber.from(50000000).mul(BigNumber.from(10).pow(18));

  // return actions to be executed by the Governor
  return [
    {
      // Claim Vault governance
      contract: cAerodromeEthStrategyProxy,
      signature: "claimGovernance()",
      args: [],
    },
    {
      contract: cStrategy,
      signature: "setHarvesterAddress(address)",
      args: [cHarvester.address],
    },
    {
      contract: oethVault,
      signature: "setOusdMetaStrategy(address)",
      args: [cStrategy.address],
    },
    {
      contract: oethVault,
      signature: "setNetOusdMintForStrategyThreshold(uint256)",
      args: [fiftyMil],
    },
    {
      contract: oethVault,
      signature: "approveStrategy(address)",
      args: [cStrategy.address],
    },
  ];
};
