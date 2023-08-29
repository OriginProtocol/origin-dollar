// USDT has its own ABI because of non standard returns
const usdtAbi = require("../test/abi/usdt.json").abi;
const daiAbi = require("../test/abi/erc20.json");
const tusdAbi = require("../test/abi/erc20.json");
const usdcAbi = require("../test/abi/erc20.json");

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
  if (isMainnet) {
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
  const { findBestMainnetTokenHolder } = require("../utils/funding");
  const addresses = require("../utils/addresses");
  const {
    usdtUnits,
    daiUnits,
    usdcUnits,
    isFork,
    isLocalhost,
  } = require("../test/helpers");

  if (!isFork && !isLocalhost) {
    throw new Error("Task can only be used on local or fork");
  }

  if (!process.env.ACCOUNTS_TO_FUND) {
    // No need to fund accounts if no accounts to fund
    return;
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

  console.log(`DAI: ${dai.address}`);
  console.log(`USDC: ${usdc.address}`);
  console.log(`USDT: ${usdt.address}`);
  console.log(`TUSD: ${tusd.address}`);

  const contractDataList = [
    {
      name: "eth",
      contract: null,
      unitsFn: ethers.utils.parseEther,
      forkSigner: isFork ? await findBestMainnetTokenHolder(null, hre) : null,
    },
    {
      name: "dai",
      contract: dai,
      unitsFn: daiUnits,
      forkSigner: isFork ? await findBestMainnetTokenHolder(dai, hre) : null,
    },
    {
      name: "usdc",
      contract: usdc,
      unitsFn: usdcUnits,
      forkSigner: isFork ? await findBestMainnetTokenHolder(usdc, hre) : null,
    },
    {
      name: "usdt",
      contract: usdt,
      unitsFn: usdtUnits,
      forkSigner: isFork ? await findBestMainnetTokenHolder(usdt, hre) : null,
    },
  ];

  for (let i = 0; i < accountsToFund.length; i++) {
    const currentAccount = accountsToFund[i];
    await Promise.all(
      contractDataList.map(async (contractData) => {
        const { contract, unitsFn, forkSigner, name } = contractData;
        const usedFundAmount = contract !== null ? fundAmount : "100";
        if (isFork) {
          // fund ether
          if (!contract) {
            await forkSigner.sendTransaction({
              to: currentAccount,
              from: forkSigner._address,
              value: hre.ethers.utils.parseEther(usedFundAmount),
            });
          } else {
            await contract
              .connect(forkSigner)
              .transfer(currentAccount, unitsFn(usedFundAmount));
          }
        } else {
          if (!contract) {
            const signerWithEth = (await hre.ethers.getSigners())[0];
            await signerWithEth.sendTransaction({
              to: currentAccount,
              value: unitsFn(usedFundAmount),
            });
          }
          await contract
            .connect(signersToFund[i])
            .mint(unitsFn(usedFundAmount));
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
