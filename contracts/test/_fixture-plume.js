const hre = require("hardhat");
const { ethers } = hre;
const mocha = require("mocha");
const { isFork, isPlumeFork, oethUnits } = require("./helpers");
const { impersonateAndFund } = require("../utils/signers");
const { nodeRevert, nodeSnapshot } = require("./_fixture");
const addresses = require("../utils/addresses");
const hhHelpers = require("@nomicfoundation/hardhat-network-helpers");
const log = require("../utils/logger")("test:fixtures-plume");

const MINTER_ROLE =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const BURNER_ROLE =
  "0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848";

let snapshotId;
const defaultPlumeFixture = deployments.createFixture(async () => {
  if (!snapshotId && !isFork) {
    snapshotId = await nodeSnapshot();
  }

  if (!isPlumeFork && isFork) {
    // Only works for Plume fork
    return;
  }

  const { deployerAddr } = await getNamedAccounts();

  if (isFork) {
    // Fund deployer account
    await impersonateAndFund(deployerAddr);
  }

  log(
    `Before deployments with param "${
      isFork ? ["plume"] : ["plume_unit_tests"]
    }"`
  );

  // Run the contract deployments
  await deployments.fixture(isFork ? ["plume"] : ["plume_unit_tests"], {
    keepExistingDeployments: true,
    fallbackToGlobal: true,
  });

  const signers = await hre.ethers.getSigners();

  const deployer = await ethers.getSigner(deployerAddr);

  const [rafael, daniel, nick, domen, clement] = signers.slice(4); // Skip first 4 addresses to avoid conflict

  const { strategistAddr, governorAddr, timelockAddr } =
    await getNamedAccounts();

  if (isFork) {
    await impersonateAndFund(governorAddr);
    await impersonateAndFund(timelockAddr);
    await impersonateAndFund(strategistAddr);
  }

  const timelock = await ethers.getSigner(timelockAddr);
  const governor = isFork ? timelock : await ethers.getSigner(governorAddr);
  const strategist = await ethers.getSigner(strategistAddr);

  // WETH
  const weth = await ethers.getContractAt("MockWETH", addresses.plume.WETH);

  // OETHp
  const oethpProxy = await ethers.getContract("OETHPlumeProxy");
  const oethp = await ethers.getContractAt("OETHPlume", oethpProxy.address);

  // wOETHp
  const wOETHpProxy = await ethers.getContract("WOETHPlumeProxy");
  const wOETHp = await ethers.getContractAt("WOETHPlume", wOETHpProxy.address);

  // OETHp Vault
  const oethpVaultProxy = await ethers.getContract("OETHPlumeVaultProxy");
  const oethpVault = await ethers.getContractAt(
    "IVault",
    oethpVaultProxy.address
  );

  // Bridged wOETH
  const woethProxy = await ethers.getContract("BridgedWOETHProxy");
  const woeth = await ethers.getContractAt("BridgedWOETH", woethProxy.address);

  let woethStrategy;

  if (isFork) {
    const woethStrategyProxy = await ethers.getContract(
      "BridgedWOETHStrategyProxy"
    );
    woethStrategy = await ethers.getContractAt(
      "BridgedWOETHStrategy",
      woethStrategyProxy.address
    );

    // Make sure we can print bridged WOETH for tests
    await woeth.connect(governor).grantRole(MINTER_ROLE, governor.address);
    await woeth.connect(governor).grantRole(BURNER_ROLE, governor.address);

    // Mint some bridged WOETH
    for (const user of [governor, rafael, nick, clement]) {
      // Mint some bridged WOETH
      await woeth.connect(governor).mint(user.address, oethUnits("1"));
    }
  }

  // And we can mint WETH
  const wethMintableContract = await ethers.getContractAt(
    [
      "function addMinter(address) external",
      "function mint(address to, uint256 amount) external",
      "function mintTo(address to, uint256 amount) external",
    ],
    addresses.plume.WETH
  );

  const oracleRouter = await ethers.getContract(
    isFork ? "OETHPlumeOracleRouter" : "MockOracleRouter"
  );

  const _mintWETH = async (signer, amount) => {
    if (isFork) {
      await wethMintableContract.connect(governor).mint(signer.address, amount);
    } else {
      await wethMintableContract
        .connect(governor)
        .mintTo(signer.address, amount);
    }
  };

  if (isFork) {
    // Allow governor to mint WETH
    const wethOwner = "0xb8ce2bE5c3c13712b4da61722EAd9d64bB57AbC9";
    const ownerSigner = await impersonateAndFund(wethOwner);
    await wethMintableContract.connect(ownerSigner).addMinter(governor.address);
  }

  for (const signer of [rafael, daniel, nick, domen, clement]) {
    // Everyone has tons of Plume for gas
    await hhHelpers.setBalance(signer.address, oethUnits("100000000"));

    // And WETH
    _mintWETH(signer, oethUnits("10000000"));

    // Set allowance on the vault
    await weth
      .connect(signer)
      .approve(oethpVault.address, oethUnits("5000000"));
  }

  return {
    // Signers
    rafael,
    daniel,
    nick,
    domen,
    clement,
    deployer,
    strategist,
    governor,
    timelock,

    // Contracts
    weth,
    oethp,
    wOETHp,
    oethpVault,

    // Bridged wOETH
    woeth,
    woethProxy,
    woethStrategy,
    oracleRouter,

    // Helpers
    _mintWETH,
  };
});

const bridgeHelperModuleFixture = deployments.createFixture(async () => {
  const fixture = await defaultPlumeFixture();

  const safeSigner = await impersonateAndFund(addresses.multichainStrategist);
  safeSigner.address = addresses.multichainStrategist;

  const bridgeHelperModule = await ethers.getContract(
    "PlumeBridgeHelperModule"
  );

  const cSafe = await ethers.getContractAt(
    ["function enableModule(address module) external"],
    ["function isModuleEnabled(address module) external view returns (bool)"],
    addresses.multichainStrategist
  );

  if (isFork && !(await cSafe.isModuleEnabled(bridgeHelperModule.address))) {
    await cSafe.connect(safeSigner).enableModule(bridgeHelperModule.address);
  }
  return {
    ...fixture,
    bridgeHelperModule,
    safeSigner,
  };
});

mocha.after(async () => {
  if (snapshotId) {
    await nodeRevert(snapshotId);
  }
});

module.exports = {
  defaultPlumeFixture,
  bridgeHelperModuleFixture,
};
