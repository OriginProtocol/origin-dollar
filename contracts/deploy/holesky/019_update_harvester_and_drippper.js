const addresses = require("../../utils/addresses");

const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");

const mainExport = async () => {
  console.log("Running 019 deployment on Holesky...");

  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  // --- 1 Deploy Fixed Rate Dripper ---
  // 1.a Deploy the Fixed Rate Dripper Proxy
  const dOETHFixedRateDripperProxy = await deployWithConfirmation(
    "OETHFixedRateDripperProxy"
  );

  const cOETHFixedRateDripperProxy = await ethers.getContract(
    "OETHFixedRateDripperProxy"
  );

  // 1.b. Deploy the OETH Fixed Rate Dripper implementation
  const dOETHFixedRateDripper = await deployWithConfirmation(
    "OETHFixedRateDripper",
    [addresses.mainnet.OETHVaultProxy, addresses.mainnet.WETH]
  );

  // 1.c. Initialize the Fixed Rate Dripper Proxy
  const initFunction = "initialize(address,address,bytes)";
  await withConfirmation(
    cOETHFixedRateDripperProxy.connect(sDeployer)[initFunction](
      dOETHFixedRateDripper.address,
      addresses.holesky.Governor, // governor
      "0x" // no init data
    )
  );
  console.log(
    `Deployed OETHFixedRateDripperProxy to ${dOETHFixedRateDripperProxy.address}`
  );
  console.log(
    `Deployed OETHFixedRateDripper to ${dOETHFixedRateDripper.address}`
  );

  // --- 2 Deploy new simple Harvester ---
  // 2.a Deploy proxy
  const dOETHSimpleHarvesterProxy = await deployWithConfirmation(
    "OETHSimpleHarvesterProxy"
  );
  const cOETHSimpleHarvesterProxy = await ethers.getContractAt(
    "OETHSimpleHarvesterProxy",
    dOETHSimpleHarvesterProxy.address
  );

  // 2.b Deploy implementation
  const dOETHHarvesterSimpleImpl = await deployWithConfirmation(
    "OETHHarvesterSimple",
    [addresses.holesky.WETH],
    undefined,
    true
  );

  const cOETHHarvesterSimpleImpl = await ethers.getContractAt(
    "OETHHarvesterSimple",
    dOETHHarvesterSimpleImpl.address
  );

  // 1.c Initialize the proxy
  const initData = cOETHHarvesterSimpleImpl.interface.encodeFunctionData(
    "initialize(address,address,address)",
    [
      addresses.holesky.Governor,
      addresses.holesky.Guardian,
      cOETHFixedRateDripperProxy.address,
    ]
  );

  const proxyInitFunction = "initialize(address,address,bytes)";
  // prettier-ignore
  await withConfirmation(
    cOETHSimpleHarvesterProxy.connect(sDeployer)[proxyInitFunction](
      cOETHHarvesterSimpleImpl.address,
      addresses.holesky.Governor,
      initData
    )
  );

  const cOETHHarvesterSimple = await ethers.getContractAt(
    "OETHHarvesterSimple",
    dOETHSimpleHarvesterProxy.address
  );
  console.log(
    `Deployed OETHHarvesterSimple to ${cOETHHarvesterSimple.address}`
  );

  // --- 3 Change harvester SSV strategies ---
  const cNativeStakingStrategyProxy = await ethers.getContract(
    "NativeStakingSSVStrategyProxy"
  );
  const cNativeStakingStrategy = await ethers.getContractAt(
    "NativeStakingSSVStrategy",
    cNativeStakingStrategyProxy.address
  );
  await withConfirmation(
    cNativeStakingStrategy
      .connect(sDeployer)
      .setHarvesterAddress(cOETHHarvesterSimple.address)
  );
  console.log("Changed harvester on the SSV strategy");

  // --- 4 Support strategies on the harvester ---
  await withConfirmation(
    cOETHHarvesterSimple
      .connect(sDeployer)
      .setSupportedStrategy(cNativeStakingStrategy.address, true)
  );
  console.log("Supported SSV strategy on the harvester");

  console.log("\nRunning 019 deployment done");
  return true;
};

mainExport.id = "019_update_harvester_and_drippper";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
