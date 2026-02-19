const { isFork, isForkWithLocalNode } = require("../../test/helpers");
const { fundAccounts } = require("../../utils/funding");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");
const { hardhatSetBalance } = require("../../test/_fund");

const usdsAbi = require("../../test/abi/usds.json").abi;

const log = require("../../utils/logger")("deploy:999_fork_test_setup");

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

  const {
    deployerAddr,
    timelockAddr,
    governorAddr,
    strategistAddr,
    multichainStrategistAddr,
  } = await getNamedAccounts();

  await hardhatSetBalance(deployerAddr, "1000000");

  const signers = await hre.ethers.getSigners();

  for (const signer of signers.slice(0, 4)) {
    await hardhatSetBalance(signer.address);
  }
  await impersonateAndFund(timelockAddr);
  await impersonateAndFund(deployerAddr);
  await impersonateAndFund(governorAddr);
  await impersonateAndFund(strategistAddr);
  await impersonateAndFund(multichainStrategistAddr);
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

  const usdt = await ethers.getContractAt(usdsAbi, addresses.mainnet.USDT);
  const usds = await ethers.getContractAt(usdsAbi, addresses.mainnet.USDS);
  const usdc = await ethers.getContractAt(usdsAbi, addresses.mainnet.USDC);
  // const frxETH = await ethers.getContractAt(usdsAbi, addresses.mainnet.frxETH);

  const [matt, josh, anna, domen, daniel, franck] = signers.slice(4);
  for (const user of [josh, matt, anna, domen, daniel, franck]) {
    // Approve Vault to move funds
    for (const asset of [ousd, usdt, usdc, usds]) {
      await resetAllowance(asset, user, vault.address);
    }

    for (const asset of [oeth]) {
      await resetAllowance(asset, user, oethVault.address);
    }
  }

  log("Funded and allowance reset for all signers");

  log(`999_fork_test_setup deployment done!`);
};

main.id = "999_fork_test_setup";
main.skip = () => isForkWithLocalNode || !isFork;

module.exports = main;
