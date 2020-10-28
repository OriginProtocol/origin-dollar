// Script for sending a governance proposal.
// This can be sent by any account, but the script uses the deployer account
// for simplicity since it is already configured in buidler.
//
// Usage:
//  - Setup your environment
//      export BUIDLER_NETWORK=mainnet
//      export DEPLOYER_PK=<pk>
//      export PREMIUM_GAS=<percentage extra>
//      export PROVIDER_URL=<url>
//  - Run:
//      node propose.js --<action>
//

const { ethers, getNamedAccounts } = require("@nomiclabs/buidler");
const { utils } = require("ethers");

const { isMainnet, isRinkeby } = require("../../test/helpers.js");
const { proposeArgs } = require("../../utils/governor");
const { getTxOpts } = require("../../utils/tx");
const addresses = require("../../utils/addresses");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

// Returns the arguments to use for sending a proposal to call harvest() on the vault.
async function proposeHarvestArgs() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );

  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "harvest()",
    },
  ]);
  const description = "Call harvest";
  return { args, description };
}

// Returns the arguments to use for sending a proposal to call setUniswapAddr(address) on the vault.
async function proposeSetUniswapAddrArgs(config) {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );

  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "setUniswapAddr(address)",
      args: [config.address],
    },
  ]);
  const description = "Call setUniswapAddr";
  return { args, description };
}

// Returns the argument to use for sending a proposal to upgrade VaultCore.
async function proposeUpgradeVaultCoreArgs(config) {
  const vaultProxy = await ethers.getContract("VaultProxy");

  const args = await proposeArgs([
    {
      contract: vaultProxy,
      signature: "upgradeTo(address)",
      args: [config.address],
    },
  ]);
  const description = "Upgrade VaultCore";
  return { args, description };
}

// Returns the arguments to use for sending a proposal call to upgrade to a new MicOracle.
// See migration 11_new_mix_oracle for reference.
async function proposeUpgradeOracleArgs() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );
  const mixOracle = await ethers.getContract("MixOracle");
  const uniswapOracle = await ethers.getContract("OpenUniswapOracle");

  const args = await proposeArgs([
    {
      contract: mixOracle,
      signature: "claimGovernance()",
    },
    {
      contract: uniswapOracle,
      signature: "claimGovernance()",
    },
    {
      contract: vaultAdmin,
      signature: "setPriceProvider(address)",
      args: [mixOracle.address],
    },
  ]);
  const description = "New MixOracle";
  return { args, description };
}

// Args to send a proposal to claim governance on new strategies.
// See migration 13_three_pool_strategies and 14_compound_dai_strategy for reference.
async function proposeClaimStrategiesArgs() {
  const curveUSDCStrategyProxy = await ethers.getContract(
    "CurveUSDCStrategyProxy"
  );
  const curveUSDCStrategy = await ethers.getContractAt(
    "ThreePoolStrategy",
    curveUSDCStrategyProxy.address
  );
  const curveUSDTStrategyProxy = await ethers.getContract(
    "CurveUSDTStrategyProxy"
  );
  const curveUSDTStrategy = await ethers.getContractAt(
    "ThreePoolStrategy",
    curveUSDTStrategyProxy.address
  );
  const compoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const compoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    compoundStrategyProxy.address
  );

  const args = await proposeArgs([
    {
      contract: curveUSDCStrategy,
      signature: "claimGovernance()",
    },
    {
      contract: curveUSDTStrategy,
      signature: "claimGovernance()",
    },
    {
      contract: compoundStrategy,
      signature: "claimGovernance()",
    },
  ]);
  const description = "Claim strategies";
  return { args, description };
}

// Args to send a proposal to remove (and liquidate) a strategy.
async function proposeRemoveStrategyArgs(config) {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );

  // Harvest the strategy first, then remove it.
  // Note: in the future we'll modify the vault's removeStrategy() implementation
  // to call harvest but for now we have to handle it as a separate step.
  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "harvest()",
    },
    {
      contract: vaultAdmin,
      signature: "removeStrategy(address)",
      args: [config.address],
    },
  ]);
  const description = "Remove strategy";
  return { args, description };
}

// Args to send a proposal to add strategies.
async function proposeAddStrategiesArgs() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );
  const curveUSDCStrategyProxy = await ethers.getContract(
    "CurveUSDCStrategyProxy"
  );
  const curveUSDTStrategyProxy = await ethers.getContract(
    "CurveUSDTStrategyProxy"
  );
  const compoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );

  // Note: Set strategies weight to 100% for USDC and USDT. 50% for DAI since we plan on
  // adding another DAI strategy soon and we'll split the funds between the two.
  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "addStrategy(address,uint256)",
      args: [curveUSDTStrategyProxy.address, utils.parseUnits("1", 18)],
    },
    {
      contract: vaultAdmin,
      signature: "addStrategy(address,uint256)",
      args: [curveUSDCStrategyProxy.address, utils.parseUnits("1", 18)],
    },
    {
      contract: vaultAdmin,
      signature: "addStrategy(address,uint256)",
      args: [compoundStrategyProxy.address, utils.parseUnits("5", 17)],
    },
  ]);
  const description = "Add strategies";
  return { args, description };
}

// Returns the argument to use for sending a proposal to upgrade the USDC and USDT Curve strategies.
async function proposeUpgradeCurveStrategiesArgs() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );
  const cCurveUSDCStrategyProxy = await ethers.getContract(
    "CurveUSDCStrategyProxy"
  );
  const cCurveUSDTStrategyProxy = await ethers.getContract(
    "CurveUSDTStrategyProxy"
  );
  const cCurveUSDCStrategy = await ethers.getContract("CurveUSDCStrategy");
  const cCurveUSDTStrategy = await ethers.getContract("CurveUSDTStrategy");

  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "setVaultBuffer(uint256)",
      args: [utils.parseUnits("999", 15)], // set buffer to 99.9% using precision 18
    },
    {
      contract: cCurveUSDCStrategyProxy,
      signature: "upgradeTo(address)",
      args: [cCurveUSDCStrategy.address],
    },
    {
      contract: cCurveUSDTStrategyProxy,
      signature: "upgradeTo(address)",
      args: [cCurveUSDTStrategy.address],
    },
  ]);
  const description = "Upgrade Curve strategies";
  return { args, description };
}

// Args to send a proposal to:
//   1. add the aave strategy
//   2. upgrade the curve USDT strategy to fix a bug
async function proposeAddAaveStrategyAndUpgradeCurveUsdtArgs() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );
  const aaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");

  const cCurveUSDTStrategyProxy = await ethers.getContract(
    "CurveUSDTStrategyProxy"
  );
  const cCurveUSDTStrategy = await ethers.getContract("CurveUSDTStrategy");

  // Note: set Aave strategy weight to a 50% to split DAI funds evenly between Aave and Compound.
  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "addStrategy(address,uint256)",
      args: [aaveStrategyProxy.address, utils.parseUnits("5", 17)], // 50% in 18 digits precision.
    },
    {
      contract: cCurveUSDTStrategyProxy,
      signature: "upgradeTo(address)",
      args: [cCurveUSDTStrategy.address],
    },
  ]);
  const description = "Add aave strategy";
  return { args, description };
}

// Returns the argument to use for sending a proposal to set the Vault's buffer
async function proposeSetVaultBufferArgs() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );

  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "setVaultBuffer(uint256)",
      args: [utils.parseUnits("2", 16)], // set buffer to 2% using precision 18
    },
  ]);
  const description = "Set vault buffer to 2%";
  return { args, description };
}

// Args to send a proposal to claim governance on the Aave strategy.
async function proposeClaimAaveStrategyArgs() {
  const aaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");

  const args = await proposeArgs([
    {
      contract: aaveStrategyProxy,
      signature: "claimGovernance()",
    },
  ]);
  const description = "Claim aave";
  return { args, description };
}

// Args to send a proposal to disable the uniswap oracle for stablecoins.
async function proposeProp14Args() {
  const mixOracle = await ethers.getContract("MixOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");

  const args = await proposeArgs([
    {
      contract: mixOracle,
      signature: "registerTokenOracles(string,address[],address[])",
      args: ["USDC", [chainlinkOracle.address], [addresses.mainnet.openOracle]],
    },
    {
      contract: mixOracle,
      signature: "registerTokenOracles(string,address[],address[])",
      args: ["USDT", [chainlinkOracle.address], [addresses.mainnet.openOracle]],
    },
    {
      contract: mixOracle,
      signature: "registerTokenOracles(string,address[],address[])",
      args: ["DAI", [chainlinkOracle.address], [addresses.mainnet.openOracle]],
    },
  ]);
  const description = "Disable uniswap oracle";
  return { args, description };
}

// Args to send a proposal to:
//  - upgrade the OUSD contract
//  - upgrade Vault Core and Admin
//  - set the liquidation threshold on Compound and ThreePool strategies (not needed on Aave since
//    there is no reward token on that one).
// TODO (franck): configure the old USDT/USDC Compound contract
async function proposeProp16Args() {
  const cOusdProxy = await ethers.getContract("OUSDProxy");
  const cOusd = await ethers.getContract("OUSD");

  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cVaultCoreProxy = await ethers.getContractAt(
    "VaultCore",
    cVaultProxy.address
  );
  const cVaultCore = await ethers.getContract("VaultCore");
  const cVaultAdmin = await ethers.getContract("VaultAdmin");

  const cCompoundStrategyProxy = await ethers.getContract("CompoundProxy");
  const cCurveUSDCStrategyProxy = await ethers.getContract(
    "CurveUSDCStrategyProxy"
  );
  const cCurveUSDTStrategyProxy = await ethers.getContract(
    "CurveUSDTStrategyProxy"
  );

  const args = await proposeArgs([
    {
      contract: cOusdProxy,
      signature: "upgradeTo(address)",
      args: [cOusd.address],
    },
    {
      contract: cVaultProxy,
      signature: "upgradeTo(address)",
      args: [cVaultCore.address],
    },
    {
      contract: cVaultCoreProxy,
      signature: "setAdminImpl(address)",
      args: [cVaultAdmin.address],
    },
    {
      contract: cCompoundStrategyProxy,
      signature: "setRewardLiquidationThreshold(uint256)",
      args: [utils.parseUnits("1", 18)], // 1 COMP with precision 18
    },
    {
      contract: cCurveUSDCStrategyProxy,
      signature: "setRewardLiquidationThreshold(uint256)",
      args: [utils.parseUnits("200", 18)], // 200 CRV with precision 18
    },
    {
      contract: cCurveUSDTStrategyProxy,
      signature: "setRewardLiquidationThreshold(uint256)",
      args: [utils.parseUnits("200", 18)], // 200 CRV with precision 18
    },
  ]);
  const description = "Prop 16";
  return { args, description };
}

async function main(config) {
  const governor = await ethers.getContract("Governor");
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = ethers.provider.getSigner(deployerAddr);

  let proposalCount = await governor.proposalCount();
  console.log("Current proposal count=", proposalCount.toString());

  let argsMethod;
  if (config.harvest) {
    console.log("Harvest proposal");
    argsMethod = proposeHarvestArgs;
  } else if (config.setUniswapAddr) {
    console.log("setUniswapAddr proposal");
    argsMethod = proposeSetUniswapAddrArgs;
  } else if (config.upgradeVaultCore) {
    console.log("upgradeVaultCore proposal");
    argsMethod = proposeUpgradeVaultCoreArgs;
  } else if (config.upgradeOracle) {
    console.log("upgradeOracle proposal");
    argsMethod = proposeUpgradeOracleArgs;
  } else if (config.claimStrategies) {
    console.log("claimStrategies proposal");
    argsMethod = proposeClaimStrategiesArgs;
  } else if (config.removeStrategy) {
    console.log("removeStrategy proposal");
    argsMethod = proposeRemoveStrategyArgs;
  } else if (config.addStrategies) {
    console.log("addStrategies proposal");
    argsMethod = proposeAddStrategiesArgs;
  } else if (config.upgradeCurveStrategies) {
    console.log("upgradeCurveStrategies proposal");
    argsMethod = proposeUpgradeCurveStrategiesArgs;
  } else if (config.setVaultBuffer) {
    console.log("setVaultBuffer proposal");
    argsMethod = proposeSetVaultBufferArgs;
  } else if (config.addAaveStrategyAndUpgradeCurveUsdt) {
    console.log("addAaveStrategyAndUpgradeCurveUsdt proposal");
    argsMethod = proposeAddAaveStrategyAndUpgradeCurveUsdtArgs;
  } else if (config.claimAaveStrategy) {
    console.log("claimAaveStrategy proposal");
    argsMethod = proposeClaimAaveStrategyArgs;
  } else if (config.prop14) {
    console.log("prop14 proposal");
    argsMethod = proposeProp14Args;
  } else if (config.prop16) {
    console.log("prop16 proposal");
    argsMethod = proposeProp16Args;
  } else {
    console.error("An action must be specified on the command line.");
    return;
  }
  const { args, description } = await argsMethod(config);

  if (config.doIt) {
    console.log("Sending a tx calling propose() on", governor.address);
    let transaction;
    transaction = await governor
      .connect(sDeployer)
      .propose(...args, description, await getTxOpts());
    console.log("Sent. tx hash:", transaction.hash);
    console.log("Waiting for confirmation...");
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    console.log("Propose tx confirmed");
  } else {
    console.log("Would send a tx to call propose() on", governor.address);
    console.log("args:", args);
  }

  const newProposalId = await governor.proposalCount();
  console.log("New proposal count=", newProposalId.toString());
  console.log(
    `Next step: call the following method on the governor at ${governor.address} via multi-sig`
  );
  console.log(`   queue(${newProposalId.toString()})`);
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
  address: args["--address"],
  harvest: args["--harvest"],
  setUniswapAddr: args["--setUniswapAddr"],
  upgradeVaultCore: args["--upgradeVaultCore"],
  upgradeOracle: args["--upgradeOracle"],
  claimStrategies: args["--claimStrategies"],
  removeStrategy: args["--removeStrategy"],
  addStrategies: args["--addStrategies"],
  upgradeCurveStrategies: args["--upgradeCurveStrategies"],
  setVaultBuffer: args["--setVaultBuffer"],
  addAaveStrategyAndUpgradeCurveUsdt:
    args["--addAaveStrategyAndUpgradeCurveUsdt"],
  claimAaveStrategy: args["--claimAaveStrategy"],
  prop14: args["--prop14"],
  prop16: args["--prop16"],
};
console.log("Config:");
console.log(config);

// Validate arguments.
if (config.address) {
  if (!utils.isAddress(config.address)) {
    throw new Error(`Invalid Ethereum address ${config.address}`);
  }
}

// Run the job.
main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
