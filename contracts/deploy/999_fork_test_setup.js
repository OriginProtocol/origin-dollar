const { isFork, isForkWithLocalNode } = require("../test/helpers");
const {
  replaceContractAt,
  deployWithConfirmation,
} = require("../utils/deploy");
const { fundAccounts } = require("../utils/funding");
const addresses = require("../utils/addresses");
const daiAbi = require("../test/abi/dai.json").abi;
const { hardhatSetBalance } = require("../test/_fund");
const { impersonateAndFund } = require("../utils/signers");

const main = async (hre) => {
  console.log(`Running 999_fork_test_setup deployment...`);

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
  const dMockOETHOracleRouterNoStale = await deployWithConfirmation(
    "MockOETHOracleRouterNoStale",
    ["0xc29562b045d80fd77c69bec09541f5c16fe20d9d"]
  );
  console.log(
    "Deployed MockOracleRouterNoStale and MockOETHOracleRouterNoStale"
  );
  await replaceContractAt(oracleRouter.address, dMockOracleRouterNoStale);
  await replaceContractAt(
    oethOracleRouter.address,
    dMockOETHOracleRouterNoStale
  );

  console.log("Replaced Oracle contracts for fork test");

  const signers = await hre.ethers.getSigners();

  for (const signer of signers.slice(0, 4)) {
    await hardhatSetBalance(signer.address);
  }
  await impersonateAndFund(timelockAddr);
  await impersonateAndFund(deployerAddr);
  await impersonateAndFund(governorAddr);
  await impersonateAndFund(strategistAddr);
  await impersonateAndFund(addresses.mainnet.OldTimelock);
  console.log("Unlocked and funded named accounts with ETH");

  await fundAccounts();
  console.log("Funded accounts with other tokens");

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

  console.log("Funded and allowance reset for all signers");

  console.log(`999_fork_test_setup deployment done!`);
};

main.id = "999_no_stale_oracles";
main.skip = () => isForkWithLocalNode || !isFork;

module.exports = main;
