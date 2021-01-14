// USDT has its own ABI because of non standard returns
const usdtAbi = require("../test/abi/usdt.json").abi;
const daiAbi = require("../test/abi/erc20.json");
const tusdAbi = require("../test/abi/erc20.json");
const usdcAbi = require("../test/abi/erc20.json");

// By default we use 10 test accounts.
const defaultNumAccounts = 10

// The first 4 hardhat accounts are reserved for use as the deployer, governor, etc...
const defaultAccountIndex = 4

// By default, fund each test account with 10k worth of each stable coin.
const defaultFundAmount = 10000

// By default, mint 1k worth of OUSD for each test account.
const defaultMintAmount = 1000

/**
 * Prints test accounts.
 */
async function accounts(taskArguments, hre, privateKeys) {
  const accounts = await hre.ethers.getSigners();
  const roles = ["Deployer", "Governor"];

  const isMainnetOrRinkeby = ["mainnet", "rinkeby"].includes(hre.network.name);
  if (isMainnetOrRinkeby) {
    privateKeys = [process.env.DEPLOYER_PK, process.env.GOVERNOR_PK];
  }

  let i = 0;
  for (const account of accounts) {
    const role = roles.length > i ? `[${roles[i]}]` : "";
    const address = await account.getAddress();
    console.log(address, privateKeys[i], role);
    if (!address) {
      throw new Error(`No address defined for role ${role}`);
    }
    i++;
  }
}

/**
 * Funds test accounts on local or fork with DAI, USDT, USDC and TUSD.
 */
async function fund(taskArguments, hre) {
  const addresses = require("../utils/addresses");
  const {
    usdtUnits,
    daiUnits,
    usdcUnits,
    tusdUnits,
    isFork,
    isLocalhost
  } = require("../test/helpers");

  if (!isFork && !isLocalhost) {
    throw new Error('Task can only be used on local or fork')
  }

  let usdt, dai, tusd, usdc;
  if (isFork) {
    usdt = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    dai = await hre.ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
    tusd = await hre.ethers.getContractAt(tusdAbi, addresses.mainnet.TUSD);
    usdc = await hre.ethers.getContractAt(usdcAbi, addresses.mainnet.USDC);
  } else {
    usdt = await hre.ethers.getContract("MockUSDT");
    dai = await hre.ethers.getContract("MockDAI");
    tusd = await hre.ethers.getContract("MockTUSD");
    usdc = await hre.ethers.getContract("MockUSDC");
  }

  let binanceSigner;
  const signers = await hre.ethers.getSigners();

  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.mainnet.Binance],
    });
    binanceSigner = await hre.ethers.provider.getSigner(
      addresses.mainnet.Binance
    );
  }

  const numAccounts = Number(taskArguments.num) || defaultNumAccounts;
  const accountIndex = Number(taskArguments.account) || defaultAccountIndex;
  const fundAmount = taskArguments.amount || defaultFundAmount

  for (let i = accountIndex; i < accountIndex + numAccounts; i++) {
    const signer = signers[i];
    const address = signer.address
    console.log(`Funding account ${i} at address ${address}`);
    await dai.connect(binanceSigner).transfer(address, daiUnits(fundAmount));
    console.log(`  Transferred ${fundAmount} DAI`)
    await usdc.connect(binanceSigner).transfer(address, usdcUnits(fundAmount));
    console.log(`  Transferred ${fundAmount} USDC`)
    await usdt.connect(binanceSigner).transfer(address, usdtUnits(fundAmount));
    console.log(`  Transferred ${fundAmount} USDT`)
    await tusd.connect(binanceSigner).transfer(address, tusdUnits(fundAmount));
    console.log(`  Transferred ${fundAmount} TUSD`)
  }
}

/**
 * Mints OUSD using USDT on local or fork.
 */
async function mint(taskArguments, hre) {
  const addresses = require("../utils/addresses");
  const {
    usdtUnits,
    isFork,
    isLocalhost
  } = require("../test/helpers");

  if (!isFork && !isLocalhost) {
    throw new Error('Task can only be used on local or fork')
  }

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);

  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);

  let usdt
  if (isFork) {
    usdt = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
  } else {
    usdt = await hre.ethers.getContract("MockUSDT");
  }

  const numAccounts = Number(taskArguments.num) || defaultNumAccounts;
  const accountIndex = Number(taskArguments.index) || defaultAccountIndex;
  const mintAmount = taskArguments.amount || defaultMintAmount

  const signers = await hre.ethers.getSigners();
  for (let i = accountIndex; i < accountIndex + numAccounts; i++) {
    const signer = signers[i];
    const address = signer.address
    console.log(`Minting ${mintAmount} OUSD for account ${i} at address ${address}`);

    // Ensure the account has sufficient USDT balance to cover the mint.
    const usdtBalance = await usdt.balanceOf(address)
    if (usdtBalance.lt(usdtUnits(mintAmount))) {
      throw new Error(`Account USDT balance insufficient to mint the requested amount`)
    }

    // Mint.
    await usdt.connect(signer).approve(vault.address, usdtUnits(mintAmount), { gasLimit: 1000000 });
    await vault.connect(signer).mint(usdt.address, usdtUnits(mintAmount), 0, { gasLimit: 2000000 });

    // Show new account's balance.
    const ousdBalance = await ousd.balanceOf(address)
    console.log('New OUSD balance=', hre.ethers.utils.formatUnits(ousdBalance, 18))
  }
}

module.exports = {
  accounts,
  fund,
  mint
}