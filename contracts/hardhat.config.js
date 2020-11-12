const ethers = require("ethers");
const { utils } = require("ethers");
const { formatUnits } = utils;

const addresses = require("./utils/addresses");
// USDT has its own ABI because of non standard returns
const usdtAbi = require("./test/abi/usdt.json").abi;
const daiAbi = require("./test/abi/erc20.json");
const tusdAbi = require("./test/abi/erc20.json");
const usdcAbi = require("./test/abi/erc20.json");
const erc20Abi = require("./test/abi/erc20.json");

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-solhint");
require("hardhat-deploy");
require("hardhat-contract-sizer");
require("hardhat-deploy-ethers");

const MAINNET_DEPLOYER = "0xAed9fDc9681D61edB5F8B8E421f5cEe8D7F4B04f";
const MAINNET_MULTISIG = "0x52BEBd3d7f37EC4284853Fd5861Ae71253A7F428";

const mnemonic =
  "replace hover unaware super where filter stone fine garlic address matrix basic";

let privateKeys = [];

let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i <= 10; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}
task(
  "mainnet_env_vars",
  "Check env vars are properly set for a Mainnet deployment",
  async () => {
    const envVars = ["PROVIDER_URL", "DEPLOYER_PK", "GOVERNOR_PK"];
    for (const envVar of envVars) {
      if (!process.env[envVar]) {
        throw new Error(
          `For Mainnet deploy env var ${envVar} must be defined.`
        );
      }
    }

    if (process.env.GAS_MULTIPLIER) {
      const value = Number(process.env.GAS_MULTIPLIER);
      if (value < 0 || value > 2) {
        throw new Error(`Check GAS_MULTIPLIER. Value out of range.`);
      }
    }
    console.log("All good. Deploy away!");
  }
);

task("accounts", "Prints the list of accounts", async (taskArguments, hre) => {
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
});

task("fund", "Fund accounts on mainnet fork", async (taskArguments, hre) => {
  const addresses = require("./utils/addresses");
  const {
    usdtUnits,
    daiUnits,
    usdcUnits,
    tusdUnits,
    isFork,
  } = require("./test/helpers");

  let usdt, dai, tusd, usdc, nonStandardToken;
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
    nonStandardToken = await hre.ethers.getContract("MockNonStandardToken");
  }

  let binanceSigner;
  const signers = await hre.ethers.getSigners();
  const { governorAddr } = await getNamedAccounts();

  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.mainnet.Binance],
    });
    binanceSigner = await hre.ethers.provider.getSigner(
      addresses.mainnet.Binance
    );
    // Send some Ethereum to Governor
    await binanceSigner.sendTransaction({
      to: governorAddr,
      value: utils.parseEther("100"),
    });
  }

  for (let i = 0; i < 10; i++) {
    if (isFork) {
      await dai
        .connect(binanceSigner)
        .transfer(await signers[i].getAddress(), daiUnits("1000"));
      await usdc
        .connect(binanceSigner)
        .transfer(await signers[i].getAddress(), usdcUnits("1000"));
      await usdt
        .connect(binanceSigner)
        .transfer(await signers[i].getAddress(), usdtUnits("1000"));
      await tusd
        .connect(binanceSigner)
        .transfer(await signers[i].getAddress(), tusdUnits("1000"));
    } else {
      await dai.connect(signers[i]).mint(daiUnits("1000"));
      await usdc.connect(signers[i]).mint(usdcUnits("1000"));
      await usdt.connect(signers[i]).mint(usdtUnits("1000"));
      await tusd.connect(signers[i]).mint(tusdUnits("1000"));
      await nonStandardToken.connect(signers[i]).mint(usdtUnits("1000"));
    }
  }
});

task(
  "debug",
  "Print information about the OUSD and Vault deployments",
  async (taskArguments, hre) => {
    //
    // Contract addresses.

    //
    // Get all contracts to operate on.
    const vaultProxy = await hre.ethers.getContract("VaultProxy");
    const ousdProxy = await hre.ethers.getContract("OUSDProxy");
    const aaveProxy = await hre.ethers.getContract("AaveStrategyProxy");
    const compoundProxy = await hre.ethers.getContract("CompoundStrategyProxy");
    const curveUSDCStrategyProxy = await hre.ethers.getContract(
      "CurveUSDCStrategyProxy"
    );
    const curveUSDTStrategyProxy = await hre.ethers.getContract(
      "CurveUSDTStrategyProxy"
    );
    const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);
    const cVault = await hre.ethers.getContract("Vault");
    const viewVault = await hre.ethers.getContractAt(
      "IViewVault",
      vaultProxy.address
    );
    const vaultAdmin = await hre.ethers.getContract("VaultAdmin");
    const vaultCore = await hre.ethers.getContract("VaultCore");
    const ousd = await hre.ethers.getContractAt("OUSD", ousdProxy.address);
    const cOusd = await hre.ethers.getContract("OUSD");
    const aaveStrategy = await hre.ethers.getContractAt(
      "AaveStrategy",
      aaveProxy.address
    );
    const compoundStrategy = await hre.ethers.getContractAt(
      "CompoundStrategy",
      compoundProxy.address
    );
    const curveUsdcStrategy = await hre.ethers.getContractAt(
      "ThreePoolStrategy",
      curveUSDCStrategyProxy.address
    );
    const curveUsdtStrategy = await hre.ethers.getContractAt(
      "ThreePoolStrategy",
      curveUSDTStrategyProxy.address
    );
    const cAaveStrategy = await hre.ethers.getContract("AaveStrategy");
    const cCompoundStrategy = await hre.ethers.getContract("CompoundStrategy");
    const cCurveUSDCStrategy = await hre.ethers.getContract(
      "CurveUSDCStrategy"
    );
    const cCurveUSDTStrategy = await hre.ethers.getContract(
      "CurveUSDTStrategy"
    );

    const mixOracle = await hre.ethers.getContract("MixOracle");
    const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");
    const uniswapOracle = await hre.ethers.getContract("OpenUniswapOracle");

    const minuteTimelock = await hre.ethers.getContract("MinuteTimelock");
    const rebaseHooks = await hre.ethers.getContract("RebaseHooks");
    const governor = await hre.ethers.getContract("Governor");

    console.log("\nContract addresses");
    console.log("====================");
    console.log(`OUSD proxy:              ${ousdProxy.address}`);
    console.log(`OUSD:                    ${cOusd.address}`);
    console.log(`Vault proxy:             ${vaultProxy.address}`);
    console.log(`Vault:                   ${cVault.address}`);
    console.log(`Vault core:              ${vaultCore.address}`);
    console.log(`Vault admin:             ${vaultAdmin.address}`);
    console.log(`AaveStrategy proxy:      ${aaveProxy.address}`);
    console.log(`AaveStrategy:            ${cAaveStrategy.address}`);
    console.log(`CompoundStrategy proxy:  ${compoundProxy.address}`);
    console.log(`CompoundStrategy:        ${cCompoundStrategy.address}`);
    console.log(`CurveUSDCStrategy proxy: ${curveUSDCStrategyProxy.address}`);
    console.log(`CurveUSDCStrategy:       ${cCurveUSDCStrategy.address}`);
    console.log(`CurveUSDTStrategy proxy: ${curveUSDTStrategyProxy.address}`);
    console.log(`CurveUSDTStrategy:       ${cCurveUSDTStrategy.address}`);
    console.log(`MixOracle:               ${mixOracle.address}`);
    console.log(`ChainlinkOracle:         ${chainlinkOracle.address}`);
    console.log(`OpenUniswapOracle:       ${uniswapOracle.address}`);
    console.log(`MinuteTimelock:          ${minuteTimelock.address}`);
    console.log(`RebaseHooks:             ${rebaseHooks.address}`);
    console.log(`Governor:                ${governor.address}`);

    //
    // Governors
    //

    // Read the current governor address on all the contracts.
    const ousdGovernorAddr = await ousd.governor();
    const vaultGovernorAddr = await vault.governor();
    const aaveStrategyGovernorAddr = await aaveStrategy.governor();
    const compoundStrategyGovernorAddr = await compoundStrategy.governor();
    const curveUsdcStrategyGovernorAddr = await curveUsdcStrategy.governor();
    const curveUsdtStrategyGovernorAddr = await curveUsdtStrategy.governor();
    const mixOracleGovernorAddr = await mixOracle.governor();
    const chainlinkOracleGovernoreAddr = await chainlinkOracle.governor();
    const openUniswapOracleGovernorAddr = await uniswapOracle.governor();
    const rebaseHooksOracleGovernorAddr = await rebaseHooks.governor();

    console.log("\nGovernor addresses");
    console.log("====================");
    console.log("OUSD:              ", ousdGovernorAddr);
    console.log("Vault:             ", vaultGovernorAddr);
    console.log("AaveStrategy:      ", aaveStrategyGovernorAddr);
    console.log("CompoundStrategy:  ", compoundStrategyGovernorAddr);
    console.log("CurveUSDCStrategy: ", curveUsdcStrategyGovernorAddr);
    console.log("CurveUSDTStrategy: ", curveUsdtStrategyGovernorAddr);
    console.log("MixOracle:         ", mixOracleGovernorAddr);
    console.log("ChainlinkOracle:   ", chainlinkOracleGovernoreAddr);
    console.log("OpenUniswapOracle: ", openUniswapOracleGovernorAddr);
    console.log("RebaseHooks        ", rebaseHooksOracleGovernorAddr);

    console.log("\nAdmin addresses");
    console.log("=================");
    const minuteTimeLockGovernorAddr = await minuteTimelock.admin();
    console.log("MinuteTimelock:    ", minuteTimeLockGovernorAddr);

    //
    // OUSD
    //
    const decimals = await ousd.decimals();
    const symbol = await ousd.symbol();
    const totalSupply = await ousd.totalSupply();
    const vaultAddress = await ousd.vaultAddress();
    const nonRebasingCredits = await ousd.nonRebasingCredits();
    const nonRebasingSupply = await ousd.nonRebasingSupply();
    const rebasingSupply = totalSupply.sub(nonRebasingSupply);
    const rebasingCreditsPerToken = await ousd.rebasingCreditsPerToken();
    const rebasingCredits = await ousd.rebasingCredits();

    console.log("\nOUSD");
    console.log("=======");
    console.log(`symbol:                  ${symbol}`);
    console.log(`decimals:                ${decimals}`);
    console.log(`totalSupply:             ${formatUnits(totalSupply, 18)}`);
    console.log(`vaultAddress:            ${vaultAddress}`);
    console.log(`nonRebasingCredits:      ${nonRebasingCredits}`);
    console.log(
      `nonRebasingSupply:       ${formatUnits(nonRebasingSupply, 18)}`
    );
    console.log(`rebasingSupply:          ${formatUnits(rebasingSupply, 18)}`);
    console.log(`rebasingCreditsPerToken: ${rebasingCreditsPerToken}`);
    console.log(`rebasingCredits:         ${rebasingCredits}`);
    //
    //
    // Vault
    //
    const rebasePaused = await vault.rebasePaused();
    const depositPaused = await vault.depositPaused();
    const redeemFeeBps = await vault.redeemFeeBps();
    const vaultBuffer = await vault.vaultBuffer();
    const autoAllocateThreshold = await vault.autoAllocateThreshold();
    const rebaseThreshold = await vault.rebaseThreshold();
    const rebaseHooksUniswapPairs = await rebaseHooks.uniswapPairs(0);
    const uniswapAddr = await vault.uniswapAddr();
    const strategyCount = await vault.getStrategyCount();
    const assetCount = await vault.getAssetCount();

    console.log("\nVault Settings");
    console.log("================");
    console.log("rebasePaused:\t\t\t", rebasePaused);
    console.log("depositPaused:\t\t\t", depositPaused);
    console.log("redeemFeeBps:\t\t\t", redeemFeeBps.toString());
    console.log("vaultBuffer:\t\t\t", formatUnits(vaultBuffer.toString(), 18));
    console.log(
      "autoAllocateThreshold (USD):\t",
      formatUnits(autoAllocateThreshold.toString(), 18)
    );
    console.log(
      "rebaseThreshold (USD):\t\t",
      formatUnits(rebaseThreshold.toString(), 18)
    );
    console.log("Rebase hooks pairs:\t\t", rebaseHooksUniswapPairs);
    console.log("Uniswap address:\t\t", uniswapAddr);
    console.log("Strategy count:\t\t\t", Number(strategyCount));
    console.log("Asset count:\t\t\t", Number(assetCount));

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
    ];

    const totalValue = await viewVault.totalValue();
    const balances = {};
    for (const asset of assets) {
      const balance = await vault["checkBalance(address)"](asset.address);
      balances[asset.symbol] = formatUnits(balance.toString(), asset.decimals);
    }

    console.log("\nVault balances");
    console.log("================");
    console.log(
      `totalValue (USD):\t $${Number(
        formatUnits(totalValue.toString(), 18)
      ).toFixed(2)}`
    );
    for (const [symbol, balance] of Object.entries(balances)) {
      console.log(`  ${symbol}:\t\t\t ${Number(balance).toFixed(2)}`);
    }

    console.log("\nVault buffer balances");
    console.log("================");

    const vaultBufferBalances = {};
    for (const asset of assets) {
      vaultBufferBalances[asset.symbol] =
        (await (
          await hre.ethers.getContractAt(erc20Abi, asset.address)
        ).balanceOf(vault.address)) /
        (1 * 10 ** asset.decimals);
    }
    for (const [symbol, balance] of Object.entries(vaultBufferBalances)) {
      console.log(`${symbol}:\t\t\t ${balance}`);
    }

    console.log("\nStrategies balances");
    console.log("=====================");
    //
    // Aave Strategy
    //
    let asset = assets[0]; // Aave only holds DAI
    let balanceRaw = await aaveStrategy.checkBalance(asset.address);
    let balance = formatUnits(balanceRaw.toString(), asset.decimals);
    console.log(`Aave ${asset.symbol}:\t balance=${balance}`);

    //
    // Compound Strategy
    //
    for (asset of assets) {
      balanceRaw = await compoundStrategy.checkBalance(asset.address);
      balance = formatUnits(balanceRaw.toString(), asset.decimals);
      console.log(`Compound ${asset.symbol}:\t balance=${balance}`);
    }

    //
    // ThreePool USDC Strategy
    //
    asset = assets[1];
    balanceRaw = await curveUsdcStrategy.checkBalance(asset.address);
    balance = formatUnits(balanceRaw.toString(), asset.decimals);
    console.log(`ThreePool ${asset.symbol}:\t balance=${balance}`);

    //
    // ThreePool USDT Strategy
    //
    asset = assets[2];
    balanceRaw = await curveUsdtStrategy.checkBalance(asset.address);
    balance = formatUnits(balanceRaw.toString(), asset.decimals);
    console.log(`ThreePool ${asset.symbol}:\t balance=${balance}`);

    //
    // Strategies settings
    //
    console.log("\nAave strategy settings");
    console.log("============================");
    console.log(
      "vaultAddress:               ",
      await aaveStrategy.vaultAddress()
    );
    console.log(
      "platformAddress:            ",
      await aaveStrategy.platformAddress()
    );
    console.log(
      "rewardTokenAddress:         ",
      await aaveStrategy.rewardTokenAddress()
    );
    console.log(
      "rewardLiquidationThreshold: ",
      (await aaveStrategy.rewardLiquidationThreshold()).toString()
    );
    for (const asset of assets) {
      console.log(
        `supportsAsset(${asset.symbol}):\t`,
        await aaveStrategy.supportsAsset(asset.address)
      );
    }

    console.log("\nCompound strategy settings");
    console.log("============================");
    console.log(
      "vaultAddress:               ",
      await compoundStrategy.vaultAddress()
    );
    console.log(
      "platformAddress:            ",
      await compoundStrategy.platformAddress()
    );
    console.log(
      "rewardTokenAddress:         ",
      await compoundStrategy.rewardTokenAddress()
    );
    console.log(
      "rewardLiquidationThreshold: ",
      (await compoundStrategy.rewardLiquidationThreshold()).toString()
    );
    for (const asset of assets) {
      console.log(
        `supportsAsset(${asset.symbol}):\t`,
        await compoundStrategy.supportsAsset(asset.address)
      );
    }

    console.log("\nCurve USDC strategy settings");
    console.log("==============================");
    console.log(
      "vaultAddress:               ",
      await curveUsdcStrategy.vaultAddress()
    );
    console.log(
      "platformAddress:            ",
      await curveUsdcStrategy.platformAddress()
    );
    console.log(
      "rewardTokenAddress:         ",
      await curveUsdcStrategy.rewardTokenAddress()
    );
    console.log(
      "rewardLiquidationThreshold: ",
      (await curveUsdcStrategy.rewardLiquidationThreshold()).toString()
    );
    for (const asset of assets) {
      console.log(
        `supportsAsset(${asset.symbol}):\t`,
        await curveUsdcStrategy.supportsAsset(asset.address)
      );
    }

    console.log("\nCurve USDT strategy settings");
    console.log("==============================");
    console.log(
      "vaultAddress:               ",
      await curveUsdtStrategy.vaultAddress()
    );
    console.log(
      "platformAddress:            ",
      await curveUsdtStrategy.platformAddress()
    );
    console.log(
      "rewardTokenAddress:         ",
      await curveUsdtStrategy.rewardTokenAddress()
    );
    console.log(
      "rewardLiquidationThreshold: ",
      (await curveUsdtStrategy.rewardLiquidationThreshold()).toString()
    );
    for (const asset of assets) {
      console.log(
        `supportsAsset(${asset.symbol}):\t`,
        await curveUsdtStrategy.supportsAsset(asset.address)
      );
    }
  }
);

task("allocate", "Call allocate() on the Vault", async (taskArguments, hre) => {
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
});

task("harvest", "Call harvest() on Vault", async (taskArguments, hre) => {
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);

  console.log("Sending a transaction to call harvest() on", vaultProxy.address);
  let transaction;
  transaction = await vault.connect(sGovernor)["harvest()"]();
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await ethers.provider.waitForTransaction(transaction.hash);
  console.log("Harvest transaction confirmed");
});

task("rebase", "Call rebase() on the Vault", async (taskArguments, hre) => {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = hre.ethers.provider.getSigner(deployerAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);

  console.log("Sending a transaction to call rebase() on", vaultProxy.address);
  let transaction;
  transaction = await vault.connect(sDeployer).rebase();
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("Rebase transaction confirmed");
});

task("balance", "Get OUSD balance of an account")
  .addParam("account", "The account's address")
  .setAction(async (taskArguments) => {
    const ousdProxy = await ethers.getContract("OUSDProxy");
    const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);

    const balance = await ousd.balanceOf(taskArguments.account);
    const credits = await ousd.creditsBalanceOf(taskArguments.account);
    console.log("OUSD balance=", formatUnits(balance.toString(), 18));
    console.log("OUSD credits=", formatUnits(credits.toString(), 18));
  });

task("reallocate", "Allocate assets from one Strategy to another")
  .addParam("from", "Address to withdraw asset from")
  .addParam("to", "Address to deposit asset to")
  .addParam("asset", "Address of asset to reallocate")
  .addParam("amount", "Amount of asset to reallocate")
  .setAction(async (taskArguments, hre) => {
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
  });

module.exports = {
  solidity: {
    version: "0.5.11",
    settings: {
      optimizer: {
        enabled: true,
      },
    },
  },
  networks: {
    hardhat: {
      mnemonic,
    },
    rinkeby: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[1],
        process.env.GOVERNOR_PK || privateKeys[1],
      ],
      gasMultiplier: process.env.GAS_MULTIPLIER || 1,
    },
    mainnet: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
      gasMultiplier: process.env.GAS_MULTIPLIER || 1,
    },
  },
  mocha: {
    bail: process.env.BAIL === "true",
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
      localhost: 0,
      mainnet: MAINNET_DEPLOYER,
    },
    governorAddr: {
      default: 1,
      localhost: process.env.FORK === "true" ? MAINNET_MULTISIG : 1,
      mainnet: MAINNET_MULTISIG,
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
