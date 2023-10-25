const { utils } = require("ethers").ethers;
const { isFork } = require("../test/helpers");
const {
  replaceContractAt,
  deployWithConfirmation,
} = require("../utils/deploy");
const { fundAccounts } = require("../utils/funding");
const addresses = require("../utils/addresses");
const daiAbi = require("../test/abi/dai.json").abi;

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

  async function impersonateAccount(address) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address],
    });
  }

  async function _hardhatSetBalance(address, amount = "10000") {
    await hre.network.provider.request({
      method: "hardhat_setBalance",
      params: [
        address,
        utils
          .parseEther(amount)
          .toHexString()
          .replace(/^0x0+/, "0x")
          .replace(/0$/, "1"),
      ],
    });
  }

  async function impersonateAndFundContract(address, amount = "100000") {
    await impersonateAccount(address);

    if (parseFloat(amount) > 0) {
      await _hardhatSetBalance(address, amount);
    }

    const signer = await ethers.provider.getSigner(address);
    signer.address = address;
    return signer;
  }

  const { deployerAddr, timelockAddr, governorAddr, strategistAddr } =
    await getNamedAccounts();

  await hre.network.provider.request({
    method: "hardhat_setBalance",
    params: [deployerAddr, utils.parseEther("1000000").toHexString()],
  });

  const oracleRouter = await ethers.getContract("OracleRouter");
  const oethOracleRouter = await ethers.getContract(
    isFork ? "OETHOracleRouter" : "OracleRouter"
  );

  // Replace OracleRouter to disable staleness
  const dMockOracleRouterNoStale = await deployWithConfirmation(
    "MockOracleRouterNoStale"
  );
  const dMockOETHOracleRouterNoStale = await deployWithConfirmation(
    "MockOETHOracleRouterNoStale"
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
    await _hardhatSetBalance(signer.address);
  }
  await impersonateAndFundContract(timelockAddr);
  await impersonateAndFundContract(deployerAddr);
  await impersonateAndFundContract(governorAddr);
  await impersonateAndFundContract(strategistAddr);
  await impersonateAndFundContract(addresses.mainnet.OldTimelock);
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
main.skip = () => !isFork;

module.exports = main;
