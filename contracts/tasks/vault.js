const addresses = require("../utils/addresses");


async function allocate(taskArguments, hre) {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = hre.ethers.provider.getSigner(deployerAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);

  console.log(
    "Sending a transaction to call allocate() on",
    vaultProxy.address
  );
  let transaction;
  transaction = await vault.connect(sDeployer).allocate();
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("Allocate transaction confirmed");
}

async function harvest(taskArguments, hre) {
  const { isMainnet, isRinkeby, isFork } = require("../test/helpers");
  const { executeProposal } = require("../utils/deploy");
  const { proposeArgs } = require("../utils/governor");

  if (isMainnet || isRinkeby) {
    throw new Error("The harvest task can not be used on mainnet or rinkeby");
  }
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);

  if (isFork) {
    // On the fork, impersonate the guardian and execute a proposal to call harvest.
    const propDescription = "Call harvest on vault";
    const propArgs = await proposeArgs([
      {
        contract: vault,
        signature: "harvest()",
      },
    ]);
    await executeProposal(propArgs, propDescription);
  } else {
    // Localhost network. Call harvest directly from the governor account.
    console.log(
      "Sending a transaction to call harvest() on",
      vaultProxy.address
    );
    await vault.connect(sGovernor)["harvest()"]();
  }
  console.log("Harvest done");
}

async function rebase(taskArguments, hre) {
  const { withConfirmation } = require("../utils/deploy");

  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = hre.ethers.provider.getSigner(deployerAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);

  console.log("Sending a transaction to call rebase() on", vaultProxy.address);
  await withConfirmation(vault.connect(sDeployer).rebase());
  console.log("Rebase transaction confirmed");
}

/**
 * Call the Vault's admin pauseCapital method.
 */
async function capital(taskArguments, hre) {
  const { isMainnet, isFork } = require("../test/helpers");
  const { executeProposal } = require("../utils/deploy");
  const { proposeArgs } = require("../utils/governor");

  const param = taskArguments.pause.toLowerCase();
  if (param !== "true" && param !== "false")
    throw new Error("Set unpause param to true or false");
  const pause = param === "true";
  console.log("Setting Vault capitalPause to", pause);

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await hre.ethers.provider.getSigner(governorAddr);

  const cVaultProxy = await hre.ethers.getContract("VaultProxy");
  const cVault = await hre.ethers.getContractAt(
    "VaultAdmin",
    cVaultProxy.address
  );

  const propDescription = pause ? "Call pauseCapital" : "Call unpauseCapital";
  const signature = pause ? "pauseCapital()" : "unpauseCapital()";
  const propArgs = await proposeArgs([{ contract: cVault, signature }]);

  if (isMainnet) {
    // On Mainnet this has to be handled manually via a multi-sig tx.
    console.log("propose, enqueue and execute a governance proposal.");
    console.log(`Governor address: ${governorAddr}`);
    console.log(`Proposal [targets, values, sigs, datas]:`);
    console.log(JSON.stringify(propArgs, null, 2));
  } else if (isFork) {
    // On Fork, simulate the governance proposal and execution flow that takes place on Mainnet.
    await executeProposal(propArgs, propDescription);
  } else {
    if (pause) {
      cVault.connect(sGovernor).pauseCapital();
      console.log("Capital paused on vault.");
    } else {
      cVault.connect(sGovernor).unpauseCapital();
      console.log("Capital unpaused on vault.");
    }
  }
}

/**
 * Allocate assets from one Strategy to another.
 */
async function reallocate(taskArguments, hre) {
  const { isFork, isMainnet, isRinkeby } = require("../test/helpers");
  const { formatUnits, parseEther }  = hre.ethers.utils

  if (isMainnet || isRinkeby) {
    throw new Error("reallocate task can not be used on Mainnet or Rinkeby");
  }

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);

  const assets = [
    {
      symbol: "DAI",
      address: addresses.mainnet.DAI,
      decimals: 18,
    },
    {
      symbol: "USDC",
      address: addresses.mainnet.USDC,
      decimals: 6,
    },
    {
      symbol: "USDT",
      address: addresses.mainnet.USDT,
      decimals: 6,
    },
  ].filter((a) => a.address.toLowerCase() === taskArguments.asset);

  const fromStrategy = await hre.ethers.getContractAt(
    "IStrategy",
    taskArguments.from
  );
  const toStrategy = await hre.ethers.getContractAt(
    "IStrategy",
    taskArguments.to
  );

  console.log(
    "Vault totalValue():\t",
    formatUnits((await vault.totalValue()).toString(), 18)
  );

  // Print balances before
  for (const asset of assets) {
    const balanceRaw = await fromStrategy.checkBalance(asset.address);
    const balance = formatUnits(balanceRaw.toString(), asset.decimals);
    console.log(`From Strategy ${asset.symbol}:\t balance=${balance}`);
  }
  for (const asset of assets) {
    const balanceRaw = await toStrategy.checkBalance(asset.address);
    const balance = formatUnits(balanceRaw.toString(), asset.decimals);
    console.log(`To Strategy ${asset.symbol}:\t balance=${balance}`);
  }

  console.log("Reallocating asset...");

  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.mainnet.Binance],
    });
    const binanceSigner = await hre.ethers.provider.getSigner(
      addresses.mainnet.Binance
    );
    // Send some Ethereum to Governor
    await binanceSigner.sendTransaction({
      to: governorAddr,
      value: parseEther("100"),
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governorAddr],
    });
  }

  await vault
    .connect(sGovernor)
    .reallocate(
      taskArguments.from,
      taskArguments.to,
      [taskArguments.asset],
      [taskArguments.amount]
    );

  console.log(
    "Vault totalValue():\t",
    formatUnits((await vault.totalValue()).toString(), 18)
  );

  // Print balances after
  for (const asset of assets) {
    const balanceRaw = await fromStrategy.checkBalance(asset.address);
    const balance = formatUnits(balanceRaw.toString(), asset.decimals);
    console.log(`From Strategy ${asset.symbol}:\t balance=${balance}`);
  }
  for (const asset of assets) {
    const balanceRaw = await toStrategy.checkBalance(asset.address);
    const balance = formatUnits(balanceRaw.toString(), asset.decimals);
    console.log(`To Strategy ${asset.symbol}:\t balance=${balance}`);
  }
}

module.exports = {
  allocate,
  capital,
  harvest,
  reallocate,
  rebase,
}