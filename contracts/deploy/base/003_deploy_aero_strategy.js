const { hardhatSetBalance } = require("../../test/_fund");
const { isFork, oethUnits } = require("../../test/helpers");
const addresses = require("../../utils/addresses");
const { isBaseForkTest } = require("../../utils/hardhat-helpers");
const { impersonateAndFund } = require("../../utils/signers");
const { deployAerodromeStrategy } = require("../deployActions");

const mainExport = async () => {
  console.log("Running 003_deploy_aero_strategy deployment on Base...");

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
    if (isBaseForkTest) {
      const signers = await hre.ethers.getSigners();

      const [minter, burner, josh, rafael, nick] = signers.slice(4); // Skip first 4 addresses to avoid conflict
      const vaultSigner = await impersonateAndFund(oethVaultProxy.address);
      await oeth.connect(vaultSigner).mint(josh.address, oethUnits("250"));
      await weth.connect(josh).deposit({ value: oethUnits("250") });

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

      const gaugeAddress = aeroVoter.gauges(poolAddress);
      console.log(
        `Gauge created for weth/oeth pool at address: ${gaugeAddress}`
      );
    }
  }

  const aeroRouter = await ethers.getContractAt(
    "IRouter",
    addresses.base.aeroRouterAddress
  );
  let poolAddress = await aeroRouter.poolFor(
    addresses.base.wethTokenAddress,
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

  console.log("Deploying Aerodrome Strategy");
  console.log(poolAddress, gaugeAddress);
  await deployAerodromeStrategy(poolAddress, gaugeAddress);

  console.log("003_deploy_aero_strategy deploy done.");
  return true;
};

mainExport.id = "003_deploy_aero_strategy";
mainExport.tags = ["base"];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
