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

const OLD_MAINNET_DEPLOYER = "0xAed9fDc9681D61edB5F8B8E421f5cEe8D7F4B04f";
const MAINNET_DEPLOYER = "0x71F78361537A6f7B6818e7A760c8bC0146D93f50";
// V1 Mainet contracts are governed by the MinuteTimelock contract.
const MAINNET_MINUTE_TIMELOCK = "0x52BEBd3d7f37EC4284853Fd5861Ae71253A7F428";
// V2 Mainnet contracts are governed by the Governor contract (which derives off Timelock).
const MAINNET_GOVERNOR = "0x8e7bDFeCd1164C46ad51b58e49A611F954D23377";
const MAINNET_MULTISIG = "0xe011fa2a6df98c69383457d87a056ed0103aa352";
const MAINNET_CLAIM_ADJUSTER = MAINNET_DEPLOYER;

const mnemonic =
  "replace hover unaware super where filter stone fine garlic address matrix basic";

let privateKeys = [];

let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i <= 10; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    if (process.env.GAS_PRICE_MULTIPLIER) {
      const value = Number(process.env.GAS_PRICE_MULTIPLIER);
      if (value < 1 || value > 2) {
        throw new Error(`Check GAS_PRICE_MULTIPLIER. Value out of range.`);
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

  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.mainnet.Binance],
    });
    binanceSigner = await hre.ethers.provider.getSigner(
      addresses.mainnet.Binance
    );
  }

  for (let i = 0; i < 10; i++) {
    console.log(`Funding account ${i}`);
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
    const { isMainnetOrRinkebyOrFork } = require("./test/helpers");

    //
    // Contract addresses.

    //
    // Get all contracts to operate on.
    const vaultProxy = await hre.ethers.getContract("VaultProxy");
    const ousdProxy = await hre.ethers.getContract("OUSDProxy");
    const aaveProxy = await hre.ethers.getContract("AaveStrategyProxy");
    const compoundProxy = await hre.ethers.getContract("CompoundStrategyProxy");
    const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);
    const cVault = await hre.ethers.getContract("Vault");
    const vaultAdmin = await hre.ethers.getContract("VaultAdmin");
    const vaultCore = await hre.ethers.getContract("VaultCore");
    const ousd = await hre.ethers.getContractAt("OUSD", ousdProxy.address);
    const cOusd = await hre.ethers.getContract("OUSD");
    const aaveStrategy = await hre.ethers.getContractAt(
      "AaveStrategy",
      aaveProxy.address
    );
    const cAaveStrategy = await hre.ethers.getContract("AaveStrategy");
    const compoundStrategy = await hre.ethers.getContractAt(
      "CompoundStrategy",
      compoundProxy.address
    );
    const cCompoundStrategy = await hre.ethers.getContract("CompoundStrategy");

    let curveUSDCStrategyProxy,
      curveUSDTStrategyProxy,
      curveUsdcStrategy,
      curveUsdtStrategy,
      cCurveUSDCStrategy,
      cCurveUSDTStrategy;
    if (!isMainnetOrRinkebyOrFork) {
      curveUSDCStrategyProxy = await hre.ethers.getContract(
        "CurveUSDCStrategyProxy"
      );
      curveUSDTStrategyProxy = await hre.ethers.getContract(
        "CurveUSDTStrategyProxy"
      );
      curveUsdcStrategy = await hre.ethers.getContractAt(
        "ThreePoolStrategy",
        curveUSDCStrategyProxy.address
      );
      curveUsdtStrategy = await hre.ethers.getContractAt(
        "ThreePoolStrategy",
        curveUSDTStrategyProxy.address
      );
      cCurveUSDCStrategy = await hre.ethers.getContract("CurveUSDCStrategy");
      cCurveUSDTStrategy = await hre.ethers.getContract("CurveUSDTStrategy");
    }

    const mixOracle = await hre.ethers.getContract("MixOracle");
    const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");

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
    if (!isMainnetOrRinkebyOrFork) {
      console.log(`CurveUSDCStrategy proxy: ${curveUSDCStrategyProxy.address}`);
      console.log(`CurveUSDCStrategy:       ${cCurveUSDCStrategy.address}`);
      console.log(`CurveUSDTStrategy proxy: ${curveUSDTStrategyProxy.address}`);
      console.log(`CurveUSDTStrategy:       ${cCurveUSDTStrategy.address}`);
    }
    console.log(`MixOracle:               ${mixOracle.address}`);
    console.log(`ChainlinkOracle:         ${chainlinkOracle.address}`);
    console.log(`Governor:                ${governor.address}`);

    //
    // Governor
    //
    const govAdmin = await governor.admin();
    const govPendingAdmin = await governor.pendingAdmin();
    const govDelay = await governor.delay();
    const govPropCount = await governor.proposalCount();
    console.log("\nGovernor");
    console.log("====================");
    console.log("Admin:           ", govAdmin);
    console.log("PendingAdmin:    ", govPendingAdmin);
    console.log("Delay (seconds): ", govDelay.toString());
    console.log("ProposalCount:   ", govPropCount.toString());

    //
    // Governance
    //

    // Read the current governor address on all the contracts.
    const ousdGovernorAddr = await ousd.governor();
    const vaultGovernorAddr = await vault.governor();
    const aaveStrategyGovernorAddr = await aaveStrategy.governor();
    const compoundStrategyGovernorAddr = await compoundStrategy.governor();
    let curveUsdcStrategyGovernorAddr, curveUsdtStrategyGovernorAddr;
    if (!isMainnetOrRinkebyOrFork) {
      curveUsdcStrategyGovernorAddr = await curveUsdcStrategy.governor();
      curveUsdtStrategyGovernorAddr = await curveUsdtStrategy.governor();
    }
    const mixOracleGovernorAddr = await mixOracle.governor();
    const chainlinkOracleGovernoreAddr = await chainlinkOracle.governor();

    console.log("\nGovernor addresses");
    console.log("====================");
    console.log("OUSD:              ", ousdGovernorAddr);
    console.log("Vault:             ", vaultGovernorAddr);
    console.log("AaveStrategy:      ", aaveStrategyGovernorAddr);
    console.log("CompoundStrategy:  ", compoundStrategyGovernorAddr);
    if (!isMainnetOrRinkebyOrFork) {
      console.log("CurveUSDCStrategy: ", curveUsdcStrategyGovernorAddr);
      console.log("CurveUSDTStrategy: ", curveUsdtStrategyGovernorAddr);
    }
    console.log("MixOracle:         ", mixOracleGovernorAddr);
    console.log("ChainlinkOracle:   ", chainlinkOracleGovernoreAddr);

    //
    // OUSD
    //
    const name = await ousd.name();
    const decimals = await ousd.decimals();
    const symbol = await ousd.symbol();
    const totalSupply = await ousd.totalSupply();
    const vaultAddress = await ousd.vaultAddress();
    const nonRebasingSupply = await ousd.nonRebasingSupply();
    const rebasingSupply = totalSupply.sub(nonRebasingSupply);
    const rebasingCreditsPerToken = await ousd.rebasingCreditsPerToken();
    const rebasingCredits = await ousd.rebasingCredits();

    console.log("\nOUSD");
    console.log("=======");
    console.log(`name:                    ${name}`);
    console.log(`symbol:                  ${symbol}`);
    console.log(`decimals:                ${decimals}`);
    console.log(`totalSupply:             ${formatUnits(totalSupply, 18)}`);
    console.log(`vaultAddress:            ${vaultAddress}`);
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
    const capitalPaused = await vault.capitalPaused();
    const redeemFeeBps = await vault.redeemFeeBps();
    const vaultBuffer = await vault.vaultBuffer();
    const autoAllocateThreshold = await vault.autoAllocateThreshold();
    const rebaseThreshold = await vault.rebaseThreshold();
    const uniswapAddr = await vault.uniswapAddr();
    const strategyCount = await vault.getStrategyCount();
    const assetCount = await vault.getAssetCount();
    const strategistAddress = await vault.strategistAddr();

    console.log("\nVault Settings");
    console.log("================");
    console.log("rebasePaused:\t\t\t", rebasePaused);
    console.log("capitalPaused:\t\t\t", capitalPaused);
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
    console.log("Uniswap address:\t\t", uniswapAddr);
    console.log("Strategy count:\t\t\t", Number(strategyCount));
    console.log("Asset count:\t\t\t", Number(assetCount));
    console.log("Strategist address:\t\t", strategistAddress);

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

    const totalValue = await vault.totalValue();
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
    let compoundsAssets = [assets[1], assets[2]]; // Compound only holds USDC and USDT
    for (asset of compoundsAssets) {
      balanceRaw = await compoundStrategy.checkBalance(asset.address);
      balance = formatUnits(balanceRaw.toString(), asset.decimals);
      console.log(`Compound ${asset.symbol}:\t balance=${balance}`);
    }

    if (!isMainnetOrRinkebyOrFork) {
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
    }

    //
    // Strategies settings
    //

    console.log("\nDefault strategies");
    console.log("============================");
    for (const asset of assets) {
      console.log(
        asset.symbol,
        `\t${await vault.assetDefaultStrategies(asset.address)}`
      );
    }

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
        `supportsAsset(${asset.symbol}):\t\t`,
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
        `supportsAsset(${asset.symbol}):\t\t`,
        await compoundStrategy.supportsAsset(asset.address)
      );
    }

    if (!isMainnetOrRinkebyOrFork) {
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
          `supportsAsset(${asset.symbol}):\t\t`,
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
          `supportsAsset(${asset.symbol}):\t\t`,
          await curveUsdtStrategy.supportsAsset(asset.address)
        );
      }
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
  const { isMainnet, isRinkeby, isFork } = require("./test/helpers");
  const { executeProposal } = require("./utils/deploy");
  const { proposeArgs } = require("./utils/governor");

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
});

task("rebase", "Call rebase() on the Vault", async (taskArguments, hre) => {
  const { withConfirmation } = require("./utils/deploy");

  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = hre.ethers.provider.getSigner(deployerAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);

  console.log("Sending a transaction to call rebase() on", vaultProxy.address);
  await withConfirmation(vault.connect(sDeployer).rebase());
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

task("execute", "Execute a governance proposal")
  .addParam("id", "Proposal ID")
  .addOptionalParam("governor", "Override Governor address")
  .setAction(async (taskArguments, hre) => {
    const { isMainnet, isRinkeby, isFork } = require("./test/helpers");
    const { withConfirmation, impersonateGuardian } = require("./utils/deploy");

    if (isMainnet || isRinkeby) {
      throw new Error("The execute task can not be used on mainnet or rinkeby");
    }

    const propId = taskArguments.id;
    const { governorAddr, guardianAddr } = await getNamedAccounts();
    const sGovernor = hre.ethers.provider.getSigner(governorAddr);
    const sGuardian = hre.ethers.provider.getSigner(guardianAddr);

    if (isFork) {
      await impersonateGuardian();
    }

    let governor;
    if (taskArguments.governor) {
      governor = await hre.ethers.getContractAt(
        "Governor",
        taskArguments.governor
      );
    } else {
      governor = await hre.ethers.getContract("Governor");
    }
    console.log(`Governor Contract: ${governor.address}`);

    // Check the state of the proposal.
    let proposalState = await governor.state(propId);
    console.log("Current proposal state:", proposalState);

    // Add the proposal to the queue if it's not in there yet.
    if (proposalState !== 1) {
      if (isFork) {
        console.log("Queuing proposal");
        await withConfirmation(governor.connect(sGuardian).queue(propId));
        console.log("Waiting for TimeLock. Sleeping for 61 seconds...");
        await sleep(61000);
      } else {
        throw new Error(
          "Error: Only proposal with state 1 (Queued) can be executed!"
        );
      }
    }

    // Display the proposal.
    const response = await governor.getActions(propId);
    console.log(`getActions(${taskArguments.id})`, response);

    // Execute the proposal.
    if (isFork) {
      // On the fork, impersonate the guardian and execute the proposal.
      await impersonateGuardian();
      await withConfirmation(governor.connect(sGuardian).execute(propId));
    } else {
      // Localhost network. Execute as the governor account.
      await governor.connect(sGovernor).execute(propId);
    }
    console.log("Confirmed proposal execution");

    // The state of the proposal should have changed.
    proposalState = await governor.state(propId);
    console.log("New proposal state:", proposalState);
  });

task("reallocate", "Allocate assets from one Strategy to another")
  .addParam("from", "Address to withdraw asset from")
  .addParam("to", "Address to deposit asset to")
  .addParam("asset", "Address of asset to reallocate")
  .addParam("amount", "Amount of asset to reallocate")
  .setAction(async (taskArguments, hre) => {
    const { isFork, isMainnet, isRinkeby } = require("./test/helpers");
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
        value: utils.parseEther("100"),
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
  });

task("capital", "Set the Vault's pauseCapital flag to true or false")
  .addParam("pause", "Pause flag. True or False")
  .setAction(async (taskArguments, hre) => {
    const { isMainnet, isFork } = require("./test/helpers");
    const { executeProposal } = require("./utils/deploy");
    const { proposeArgs } = require("./utils/governor");

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
  });

task("executeProposalOnFork", "Enqueue and execute a proposal on the Fork")
  .addParam("id", "Id of the proposal")
  .setAction(async (taskArguments) => {
    const { executeProposalOnFork } = require("./utils/deploy");

    const proposalId = Number(taskArguments.id);
    console.log("Enqueueing and executing proposal", proposalId);
    await executeProposalOnFork(proposalId);
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
      accounts: {
        mnemonic,
      },
    },
    rinkeby: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[1],
        process.env.GOVERNOR_PK || privateKeys[1],
      ],
    },
    mainnet: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
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
      // On Mainnet and fork, the governor is the Governor contract.
      localhost: process.env.FORK === "true" ? MAINNET_GOVERNOR : 1,
      mainnet: MAINNET_GOVERNOR,
    },
    guardianAddr: {
      default: 1,
      // On mainnet and fork, the guardian is the multi-sig.
      localhost: process.env.FORK === "true" ? MAINNET_MULTISIG : 1,
      mainnet: MAINNET_MULTISIG,
    },
    adjusterAddr: {
      default: 0,
      localhost: process.env.FORK === "true" ? MAINNET_CLAIM_ADJUSTER : 0,
      mainnet: MAINNET_CLAIM_ADJUSTER,
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
