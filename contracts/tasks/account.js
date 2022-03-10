const _ = require("lodash");

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

// By default, mint 1k worth of OUSD for each test account.
const defaultMintAmount = 1000;

// By default, redeem 1k worth of OUSD for each test account.
const defaultRedeemAmount = 1000;

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
  const { findBestMainnetTokenHolder } = require("../utils/funding");
  const addresses = require("../utils/addresses");
  const {
    usdtUnits,
    daiUnits,
    usdcUnits,
    tusdUnits,
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

/**
 * Mints OUSD using USDT on local or fork.
 */
async function mint(taskArguments, hre) {
  const addresses = require("../utils/addresses");
  const { usdtUnits, isFork, isLocalhost } = require("../test/helpers");

  if (!isFork && !isLocalhost) {
    throw new Error("Task can only be used on local or fork");
  }

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);

  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);

  let usdt;
  if (isFork) {
    usdt = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
  } else {
    usdt = await hre.ethers.getContract("MockUSDT");
  }

  const numAccounts = Number(taskArguments.num) || defaultNumAccounts;
  const accountIndex = Number(taskArguments.index) || defaultAccountIndex;
  const mintAmount = taskArguments.amount || defaultMintAmount;

  const signers = await hre.ethers.getSigners();
  for (let i = accountIndex; i < accountIndex + numAccounts; i++) {
    const signer = signers[i];
    const address = signer.address;
    console.log(
      `Minting ${mintAmount} OUSD for account ${i} at address ${address}`
    );

    // Ensure the account has sufficient USDT balance to cover the mint.
    const usdtBalance = await usdt.balanceOf(address);
    if (usdtBalance.lt(usdtUnits(mintAmount))) {
      throw new Error(
        `Account USDT balance insufficient to mint the requested amount`
      );
    }

    // for some reason we need to call impersonateAccount even on default list of signers
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [signer.address],
    });

    // Reset approval before requesting a fresh one, or non first approve calls will fail
    await usdt
      .connect(signer)
      .approve(vault.address, "0x0", { gasLimit: 1000000 });
    await usdt
      .connect(signer)
      .approve(vault.address, usdtUnits(mintAmount), { gasLimit: 1000000 });

    // Mint.
    await vault
      .connect(signer)
      .mint(usdt.address, usdtUnits(mintAmount), 0, { gasLimit: 2000000 });

    // Show new account's balance.
    const ousdBalance = await ousd.balanceOf(address);
    console.log(
      "New OUSD balance=",
      hre.ethers.utils.formatUnits(ousdBalance, 18)
    );
  }
}

/**
 * Redeems OUSD on fork for specific account
 */
async function redeemFor(taskArguments, hre) {
  const addresses = require("../utils/addresses");
  const {
    ousdUnits,
    ousdUnitsFormat,
    daiUnitsFormat,
    usdcUnitsFormat,
    usdtUnitsFormat,
    isFork,
    isLocalhost,
  } = require("../test/helpers");

  if (!isFork) {
    throw new Error("Task can only be used on fork");
  }

  const ousd = await ethers.getContractAt("OUSD", addresses.mainnet.OUSDProxy);
  const vault = await ethers.getContractAt(
    "IVault",
    addresses.mainnet.VaultProxy
  );
  const dai = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.DAI);
  const usdc = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.USDC);
  const usdt = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);

  const address = taskArguments.account;

  const signer = await hre.ethers.getSigner(address);
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });

  const redeemAmount = taskArguments.amount;

  console.log(`Redeeming ${redeemAmount} OUSD for address ${address}`);

  // Show the current balances.
  let ousdBalance = await ousd.balanceOf(address);
  let daiBalance = await dai.balanceOf(address);
  let usdcBalance = await usdc.balanceOf(address);
  let usdtBalance = await usdt.balanceOf(address);
  console.log("OUSD balance=", ousdUnitsFormat(ousdBalance, 18));
  console.log("DAI balance=", daiUnitsFormat(daiBalance, 18));
  console.log("USDC balance=", usdcUnitsFormat(usdcBalance, 6));
  console.log("USDT balance=", usdtUnitsFormat(usdtBalance, 6));

  const redeemAmountInt = parseInt(redeemAmount);
  // Redeem.
  await vault
    .connect(signer)
    .redeem(
      ousdUnits(redeemAmount),
      ousdUnits((redeemAmountInt - redeemAmountInt * 0.05).toString()),
      { gasLimit: 2500000 }
    );

  // Show the new balances.
  ousdBalance = await ousd.balanceOf(address);
  daiBalance = await dai.balanceOf(address);
  usdcBalance = await usdc.balanceOf(address);
  usdtBalance = await usdt.balanceOf(address);
  console.log("New OUSD balance=", ousdUnitsFormat(ousdBalance, 18));
  console.log("New DAI balance=", daiUnitsFormat(daiBalance, 18));
  console.log("New USDC balance=", usdcUnitsFormat(usdcBalance, 18));
  console.log("New USDT balance=", usdtUnitsFormat(usdtBalance, 18));
}

/**
 * Redeems OUSD on local or fork.
 */
async function redeem(taskArguments, hre) {
  const addresses = require("../utils/addresses");
  const {
    ousdUnits,
    ousdUnitsFormat,
    daiUnitsFormat,
    usdcUnitsFormat,
    usdtUnitsFormat,
    isFork,
    isLocalhost,
  } = require("../test/helpers");

  if (!isFork && !isLocalhost) {
    throw new Error("Task can only be used on local or fork");
  }

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);

  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);

  let dai, usdc, usdt;
  if (isFork) {
    dai = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.DAI);
    usdc = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.USDC);
    usdt = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
  } else {
    dai = await hre.ethers.getContract("MockDAI");
    usdc = await hre.ethers.getContract("MockUSDC");
    usdt = await hre.ethers.getContract("MockUSDT");
  }

  const numAccounts = Number(taskArguments.num) || defaultNumAccounts;
  const accountIndex = Number(taskArguments.index) || defaultAccountIndex;
  const redeemAmount = taskArguments.amount || defaultRedeemAmount;

  const signers = await hre.ethers.getSigners();
  for (let i = accountIndex; i < accountIndex + numAccounts; i++) {
    const signer = signers[i];
    const address = signer.address;
    console.log(
      `Redeeming ${redeemAmount} OUSD for account ${i} at address ${address}`
    );

    // Show the current balances.
    let ousdBalance = await ousd.balanceOf(address);
    let daiBalance = await dai.balanceOf(address);
    let usdcBalance = await usdc.balanceOf(address);
    let usdtBalance = await usdt.balanceOf(address);
    console.log("OUSD balance=", ousdUnitsFormat(ousdBalance, 18));
    console.log("DAI balance=", daiUnitsFormat(daiBalance, 18));
    console.log("USDC balance=", usdcUnitsFormat(usdcBalance, 6));
    console.log("USDT balance=", usdtUnitsFormat(usdtBalance, 6));

    // Redeem.
    await vault
      .connect(signer)
      .redeem(ousdUnits(redeemAmount), 0, { gasLimit: 2000000 });

    // Show the new balances.
    ousdBalance = await ousd.balanceOf(address);
    daiBalance = await dai.balanceOf(address);
    usdcBalance = await usdc.balanceOf(address);
    usdtBalance = await usdt.balanceOf(address);
    console.log("New OUSD balance=", ousdUnitsFormat(ousdBalance, 18));
    console.log("New DAI balance=", daiUnitsFormat(daiBalance, 18));
    console.log("New USDC balance=", usdcUnitsFormat(usdcBalance, 18));
    console.log("New USDT balance=", usdtUnitsFormat(usdtBalance, 18));
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
  mint,
  redeem,
  redeemFor,
  transfer,
};
