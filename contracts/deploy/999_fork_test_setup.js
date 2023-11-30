const { isFork, isForkWithLocalNode } = require("../test/helpers");
const { deployWithConfirmation } = require("../utils/deploy");
const { fundAccounts } = require("../utils/funding");
const addresses = require("../utils/addresses");
const { replaceContractAt } = require("../utils/hardhat");
const { impersonateAndFund } = require("../utils/signers");
const { hardhatSetBalance } = require("../test/_fund");

const daiAbi = require("../test/abi/dai.json").abi;

const log = require("../utils/logger")("deploy:999_fork_test_setup");

const main = async (hre) => {
  log(`Running 999_fork_test_setup deployment...`);

  async function resetAllowance(
    tokenContract,
    signer,
    toAddress,
    allowance = "10000000000000000000000000000000000000000000000000"
  ) {
    await tokenContract.connect(signer).approve(toAddress, "0");
    await tokenContract.connect(signer).approve(toAddress, allowance);
  }

  const { deployerAddr, timelockAddr, governorAddr, strategistAddr } =
    await getNamedAccounts();

  hardhatSetBalance(deployerAddr, "1000000");

  const oracleRouter = await ethers.getContract("OracleRouter");
  const oethOracleRouter = await ethers.getContract(
    isFork ? "OETHOracleRouter" : "OracleRouter"
  );

  // Replace OracleRouter to disable staleness
  const dMockOracleRouterNoStale = await deployWithConfirmation(
    "MockOracleRouterNoStale"
  );
  const dAuraPriceFeed = await ethers.getContract("AuraWETHPriceFeed");
  const dMockOETHOracleRouterNoStale = await deployWithConfirmation(
    "MockOETHOracleRouterNoStale",
    [dAuraPriceFeed.address]
  );
  log("Deployed MockOracleRouterNoStale and MockOETHOracleRouterNoStale");
  await replaceContractAt(oracleRouter.address, dMockOracleRouterNoStale);
  await replaceContractAt(
    oethOracleRouter.address,
    dMockOETHOracleRouterNoStale
  );

  log("Replaced Oracle contracts for fork test");

  const signers = await hre.ethers.getSigners();

  for (const signer of signers.slice(0, 4)) {
    await hardhatSetBalance(signer.address);
  }
  await impersonateAndFund(timelockAddr);
  await impersonateAndFund(deployerAddr);
  await impersonateAndFund(governorAddr);
  await impersonateAndFund(strategistAddr);
  await impersonateAndFund(addresses.mainnet.OldTimelock);
  log("Unlocked and funded named accounts with ETH");

  await fundAccounts();
  log("Funded accounts with other tokens");

  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);

  const OETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  const oethVault = await ethers.getContractAt(
    "IVault",
    OETHVaultProxy.address
  );

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);

  const oethProxy = await ethers.getContract("OETHProxy");
  const oeth = await ethers.getContractAt("OETH", oethProxy.address);

  const usdt = await ethers.getContractAt(daiAbi, addresses.mainnet.USDT);
  const dai = await ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
  const usdc = await ethers.getContractAt(daiAbi, addresses.mainnet.USDC);
  const frxETH = await ethers.getContractAt(daiAbi, addresses.mainnet.frxETH);

  const [matt, josh, anna, domen, daniel, franck] = signers.slice(4);
  for (const user of [josh, matt, anna, domen, daniel, franck]) {
    // Approve Vault to move funds
    for (const asset of [ousd, usdt, usdc, dai]) {
      await resetAllowance(asset, user, vault.address);
    }

    for (const asset of [oeth, frxETH]) {
      await resetAllowance(asset, user, oethVault.address);
    }
  }

  log("Funded and allowance reset for all signers");

  log(`999_fork_test_setup deployment done!`);
};

main.id = "999_no_stale_oracles";
main.skip = () => isForkWithLocalNode || !isFork;

module.exports = main;
