// USDT has its own ABI because of non standard returns
const usdtAbi = require("../test/abi/usdt.json").abi;
const usdsAbi = require("../test/abi/erc20.json");
const tusdAbi = require("../test/abi/erc20.json");
const usdcAbi = require("../test/abi/erc20.json");
const { hardhatSetBalance, setERC20TokenBalance } = require("../test/_fund");

// By default we use 10 test accounts.
const defaultNumAccounts = 10;

// The first 4 hardhat accounts are reserved for use as the deployer, governor, etc...
const defaultAccountIndex = 4;

// By default, fund each test account with 10k worth of each stable coin.
const defaultFundAmount = 10000;

/**
 * Prints test accounts.
 */
async function accounts(taskArguments, hre, privateKeys) {
  const accounts = await hre.ethers.getSigners();
  const roles = ["Deployer", "Governor"];

  const isMainnet = hre.network.name == "mainnet";
  const isArbitrum = hre.network.name == "arbitrumOne";

  if (isMainnet || isArbitrum) {
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
 * Funds test accounts on local or fork with USDS, USDT, USDC and TUSD.
 */
async function fund(taskArguments, hre) {
  const addresses = require("../utils/addresses");
  const { isFork, isLocalhost } = require("../test/helpers");

  if (!isFork && !isLocalhost) {
    throw new Error("Task can only be used on local or fork");
  }

  if (hre.network.config.chainId !== 1) {
    // Skip funding if it's not mainnet
    return;
  }

  if (!process.env.ACCOUNTS_TO_FUND) {
    // No need to fund accounts if no accounts to fund
    return;
  }

  let usdt, usds, tusd, usdc;
  if (isFork) {
    usdt = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    usds = await hre.ethers.getContractAt(usdsAbi, addresses.mainnet.USDS);
    tusd = await hre.ethers.getContractAt(tusdAbi, addresses.mainnet.TUSD);
    usdc = await hre.ethers.getContractAt(usdcAbi, addresses.mainnet.USDC);
  } else {
    usdt = await hre.ethers.getContract("MockUSDT");
    usds = await hre.ethers.getContract("MockUSDS");
    tusd = await hre.ethers.getContract("MockTUSD");
    usdc = await hre.ethers.getContract("MockUSDC");
  }

  const signers = await hre.ethers.getSigners();

  let accountsToFund;
  let signersToFund;

  if (taskArguments.accountsfromenv) {
    if (!isFork) {
      throw new Error("accountsfromenv param only works in fork mode");
    }
    accountsToFund = process.env.ACCOUNTS_TO_FUND.split(",");
  } else {
    const numAccounts = Number(taskArguments.num) || defaultNumAccounts;
    const accountIndex = Number(taskArguments.account) || defaultAccountIndex;

    signersToFund = signers.splice(accountIndex, numAccounts);
    accountsToFund = signersToFund.map((signer) => signer.address);
  }

  const fundAmount = taskArguments.amount || defaultFundAmount;

  console.log(`USDS: ${usds.address}`);
  console.log(`USDC: ${usdc.address}`);
  console.log(`USDT: ${usdt.address}`);
  console.log(`TUSD: ${tusd.address}`);

  const contractDataList = [
    {
      name: "eth",
      token: null,
    },
    {
      name: "usds",
      token: usds,
    },
    {
      name: "usdc",
      token: usdc,
    },
    {
      name: "usdt",
      token: usdt,
    },
  ];

  for (let i = 0; i < accountsToFund.length; i++) {
    const currentAccount = accountsToFund[i];
    await Promise.all(
      contractDataList.map(async (contractData) => {
        const { token, name } = contractData;
        const usedFundAmount = token !== null ? fundAmount : "1000000";

        if (!token) {
          await hardhatSetBalance(currentAccount, usedFundAmount);
        } else {
          await setERC20TokenBalance(
            currentAccount,
            token,
            usedFundAmount,
            hre
          );
        }

        console.log(
          `Funded ${currentAccount} with ${usedFundAmount} ${name.toUpperCase()}`
        );
      })
    );
  }
}

// Sends OUSD to a destination address.
async function transfer(taskArguments) {
  const {
    ousdUnits,
    ousdUnitsFormat,
    isFork,
    isLocalHost,
  } = require("../test/helpers");

  if (!isFork && !isLocalHost) {
    throw new Error("Task can only be used on local or fork");
  }

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);

  const index = Number(taskArguments.index);
  const amount = taskArguments.amount;
  const to = taskArguments.to;

  const signers = await hre.ethers.getSigners();
  const signer = signers[index];

  // Print balances prior to the transfer
  console.log("\nOUSD balances prior transfer");
  console.log(
    `${signer.address}: ${ousdUnitsFormat(
      await ousd.balanceOf(signer.address)
    )} OUSD`
  );
  console.log(`${to}: ${ousdUnitsFormat(await ousd.balanceOf(to))} OUSD`);

  // Send OUSD.
  console.log(
    `\nTransferring ${amount} OUSD from ${signer.address} to ${to}...`
  );
  await ousd.connect(signer).transfer(to, ousdUnits(amount));

  // Print balances after to the transfer
  console.log("\nOUSD balances after transfer");
  console.log(
    `${signer.address}: ${ousdUnitsFormat(
      await ousd.balanceOf(signer.address)
    )} OUSD`
  );
  console.log(`${to}: ${ousdUnitsFormat(await ousd.balanceOf(to))} OUSD`);
}

module.exports = {
  accounts,
  fund,
  transfer,
};
