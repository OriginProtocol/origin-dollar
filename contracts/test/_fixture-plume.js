const hre = require("hardhat");
const { ethers } = hre;
const mocha = require("mocha");
const { isFork, isPlumeFork, oethUnits } = require("./helpers");
const { impersonateAndFund } = require("../utils/signers");
const { nodeRevert, nodeSnapshot } = require("./_fixture");
const addresses = require("../utils/addresses");
const hhHelpers = require("@nomicfoundation/hardhat-network-helpers");

const log = require("../utils/logger")("test:fixtures-plume");

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
  // // TODO: update this on fork later
  // const strategist = signers[3];

  // WETH
  // TODO: Change this later to actual address
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

  for (const signer of [rafael, daniel, nick, domen, clement]) {
    // Everyone has tons of Plume for gas
    await hhHelpers.setBalance(signer.address, oethUnits("100000000"));

    // And WETH
    await weth.connect(signer).mint(oethUnits("10000000"));

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
    strategist: deployer,
    governor: deployer,

    // Contracts
    weth,
    oethp,
    wOETHp,
    oethpVault,
  };
});

mocha.after(async () => {
  if (snapshotId) {
    await nodeRevert(snapshotId);
  }
});

module.exports = {
  defaultPlumeFixture,
};
