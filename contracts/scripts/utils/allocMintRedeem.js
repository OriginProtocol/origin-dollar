// Script for calling allocate on the vault.
//
// Usage:
//  - Setup your environment
//      export BUIDLER_NETWORK=mainnet
//      export DEPLOYER_PK=<pk>
//      export PREMIUM_GAS=<percentage extra>
//      export PROVIDER_URL=<url>
//  - Run:
//      node allocate.js --doIt=true
//

const { ethers, getNamedAccounts } = require("@nomiclabs/buidler");

const {
  isMainnet,
  isRinkeby,
  usdtUnits,
  daiUnits,
  usdcUnits,
  tusdUnits,
} = require("../../test/helpers.js");
const { getTxOpts } = require("../../utils/tx");
const addresses = require("../../utils/addresses");
const daiAbi = require("../../test/abi/dai.json").abi;

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

async function main(config) {
  const { deployerAddr } = await getNamedAccounts();

  // currently this is the minuteTimelock's address
  const sGovernor = ethers.provider.getSigner(
    "0x52BEBd3d7f37EC4284853Fd5861Ae71253A7F428"
  );
  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const signers = await ethers.getSigners();

  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);
  const ousdProxy = await ethers.getContract("OUSDProxy");
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);

  const compoundProxy = await ethers.getContract("CompoundStrategyProxy");
  const compound = await ethers.getContractAt(
    "CompoundStrategy",
    compoundProxy.address
  );

  const aaveProxy = await ethers.getContract("AaveStrategyProxy");
  const aave = await ethers.getContractAt("AaveStrategy", aaveProxy.address);

  const txOpts = await getTxOpts();
  if (config.gasLimit) {
    txOpts.gasLimit = Number(config.gasLimit);
  } else {
    txOpts.gasLimit = 6500000;
  }
  console.log("Tx opts", txOpts);

  const dai = await ethers.getContractAt(daiAbi, addresses.mainnet.DAI);

  if (config.doIt) {
    let transaction;
    console.log("set to 0 buffer");
    transaction = await vault.connect(sGovernor).setVaultBuffer(0, txOpts);
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );

    if (config.removeComp) {
      console.log("remove compound");
      transaction = await vault
        .connect(sGovernor)
        .removeStrategy(compound.address, txOpts);
      await ethers.provider.waitForTransaction(
        transaction.hash,
        NUM_CONFIRMATIONS
      );
    }

    /*
    console.log("liquidating compound");
    transaction = await compound.connect(sGovernor).liquidate(txOpts);
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    console.log("liquidating aave");
    transaction = await aave.connect(sGovernor).liquidate(txOpts);
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    console.log("[liquidate]    Aave balance:", (await aave.checkBalance(dai.address)).toString());
    */

    const dummy = signers[0];

    console.log(
      "[Mint pre]    dai  balance:",
      (await dai.balanceOf(await dummy.getAddress())).toString()
    );
    console.log(
      "[Mint pre]    Aave balance:",
      (await aave.checkBalance(dai.address)).toString()
    );
    console.log(
      "[Mint pre]    comp balance:",
      (await compound.checkBalance(dai.address)).toString()
    );
    const mintAmount = daiUnits("100");

    transaction = await dai
      .connect(dummy)
      .approve(vault.address, mintAmount, txOpts);
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    transaction = await vault
      .connect(dummy)
      .mint(dai.address, mintAmount, txOpts);
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );

    console.log("Sending a tx to call allocate() on", vaultProxy.address);
    transaction = await vault.connect(sDeployer).allocate(txOpts);
    console.log("Sent. tx hash:", transaction.hash);
    console.log("Waiting for confirmation...");
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    console.log("Allocate tx confirmed");

    console.log(
      "[Mint done]   dai  balance:",
      (await dai.balanceOf(await dummy.getAddress())).toString()
    );
    console.log(
      "[Mint done]   ousd balance:",
      (await ousd.balanceOf(await dummy.getAddress())).toString()
    );
    console.log(
      "[Mint done]   Aave balance:",
      (await aave.checkBalance(dai.address)).toString()
    );
    console.log(
      "[Mint done]   comp balance:",
      (await compound.checkBalance(dai.address)).toString()
    );

    transaction = await vault.connect(dummy).redeemAll(txOpts);
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );

    console.log(
      "[Redem done]  dai  balance:",
      (await dai.balanceOf(await dummy.getAddress())).toString()
    );
    console.log(
      "[Redeem done] ousd balance:",
      (await ousd.balanceOf(await dummy.getAddress())).toString()
    );
    console.log(
      "[Redeem done] Aave balance:",
      (await aave.checkBalance(dai.address)).toString()
    );
    console.log(
      "[Redeem done] comp balance:",
      (await compound.checkBalance(dai.address)).toString()
    );
  } else {
    console.log(
      `Would send a tx to call allocate() on Vault at ${vault.address}`
    );
  }
  console.log("Done");
}

// Util to parse command line args.
function parseArgv() {
  const args = {};
  for (const arg of process.argv) {
    const elems = arg.split("=");
    const key = elems[0];
    const val = elems.length > 1 ? elems[1] : true;
    args[key] = val;
  }
  return args;
}

// Parse config.
const args = parseArgv();
const config = {
  // dry run mode vs for real.
  doIt: args["--doIt"] === "true" || false,
  gasLimit: args["--gasLimit"],
  removeComp: args["--removeComp"] === "true" || false,
};
console.log("Config:");
console.log(config);

// Run the job.
main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
