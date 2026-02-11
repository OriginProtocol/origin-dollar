// Script for sending a governance proposal.
// This can be sent by any account, but the script uses the deployer account
// for simplicity since it is already configured in Hardhat.
//
// Usage:
//  - Setup your environment
//      export HARDHAT_NETWORK=mainnet
//      export DEPLOYER_PK=<pk>
//      export GAS_PRICE_MULTIPLIER=<multiplier> e.g. 1.1
//      export PROVIDER_URL=<url>
//  - Run:
//      node propose.js --<action>
//

const { ethers, getNamedAccounts } = require("hardhat");
const { utils } = require("ethers");

const { isMainnet } = require("../../test/helpers.js");
const { proposeArgs } = require("../../utils/governor");
const { getTxOpts } = require("../../utils/tx");
const addresses = require("../../utils/addresses");

// Wait for 3 blocks confirmation on Mainnet.
const NUM_CONFIRMATIONS = isMainnet ? 3 : 0;

// Proposal for setting the timelock delay to 48hrs
async function proposeGovernorSetDelayArgs() {
  const governor = await ethers.getContract("Governor");

  const description = "Set timelock to 48hrs";
  const args = await proposeArgs([
    {
      contract: governor,
      signature: "setDelay(uint256)",
      args: [48 * 60 * 60], // 48hrs
    },
  ]);
  return { args, description };
}

async function proposeVaultv2GovernanceArgs() {
  const mixOracle = await ethers.getContract("MixOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  const cAaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    cAaveStrategyProxy.address
  );
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    cCompoundStrategyProxy.address
  );
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

  const description = "Vault V2 governance";
  const args = await proposeArgs([
    {
      contract: mixOracle,
      signature: "claimGovernance()",
    },
    {
      contract: chainlinkOracle,
      signature: "claimGovernance()",
    },
    {
      contract: cAaveStrategy,
      signature: "claimGovernance()",
    },
    {
      contract: cCompoundStrategy,
      signature: "claimGovernance()",
    },
    {
      contract: cVault,
      signature: "claimGovernance()",
    },
  ]);
  return { args, description };
}

// Transfer governance of the OUSD contract from old to new governor.
// IMPORTANT: must be executed against the old governor.
async function proposeOusdNewGovernorArgs() {
  const { governorAddr } = await getNamedAccounts();
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);

  const description = "OUSD governance transfer";
  const args = await proposeArgs([
    {
      contract: cOUSD,
      signature: "transferGovernance(address)",
      args: [governorAddr],
    },
  ]);
  return { args, description };
}

// - claimGovernance
// - upgradeTo OUSDReset
// - call reset()
// - call setVaultAddress()
// - upgradeTo OUSD
async function proposeOusdv2ResetArgs() {
  const dOUSD = await ethers.getContract("OUSD");
  const dOUSDReset = await ethers.getContract("OUSDReset");
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cOUSDReset = await ethers.getContractAt(
    "OUSDReset",
    cOUSDProxy.address
  );
  const cVaultProxy = await ethers.getContract("VaultProxy");

  const description = "OUSD Reset";
  const args = await proposeArgs([
    {
      contract: cOUSDProxy,
      signature: "claimGovernance()",
    },
    {
      contract: cOUSDProxy,
      signature: "upgradeTo(address)",
      args: [dOUSDReset.address],
    },
    {
      contract: cOUSDReset,
      signature: "reset()",
    },
    {
      contract: cOUSDReset,
      signature: "setVaultAddress(address)",
      args: [cVaultProxy.address],
    },
    {
      contract: cOUSDProxy,
      signature: "upgradeTo(address)",
      args: [dOUSD.address],
    },
  ]);
  return { args, description };
}

// Returns the argument to use for sending a proposal to upgrade OUSD.
async function proposeUpgradeStakingArgs() {
  const stakingProxy = await ethers.getContract("OGNStakingProxy");
  const staking = await ethers.getContract("SingleAssetStaking");

  const args = await proposeArgs([
    {
      contract: stakingProxy,
      signature: "upgradeTo(address)",
      args: [staking.address],
    },
  ]);
  const description = "Upgrade OGNStaking";
  return { args, description };
}

async function proposeClaimOGNStakingGovernance() {
  const proxy = await ethers.getContract("OGNStakingProxy");

  const args = await proposeArgs([
    {
      contract: proxy,
      signature: "claimGovernance()",
    },
  ]);
  const description = "Claim OGNStaking";
  return { args, description };
}

async function proposeSetMaxSupplyDiffArgs() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );

  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "setMaxSupplyDiff(uint256)",
      args: [utils.parseUnits("5", 16)], // 5%
    },
  ]);
  const description = "Set maxSupplyDiff";
  return { args, description };
}

async function proposeUnpauseRebaseArgs() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );

  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "unpauseRebase()",
    },
  ]);
  const description = "Unpause rebase";
  return { args, description };
}

async function proposeUnpauseCapitalArgs() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );

  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "unpauseCapital()",
    },
  ]);
  const description = "Unpause capital";
  return { args, description };
}

async function proposePauseCapitalArgs() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );

  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "pauseCapital()",
    },
  ]);
  const description = "Pause capital";
  return { args, description };
}

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

// Call setRebaseHooksAddr on the vault.
async function proposeSetRebaseHookAddrArgs() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );

  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "setRebaseHooksAddr(address)",
      args: [config.address],
    },
  ]);
  const description = "setRebaseHooksAddr";
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

// Returns the arguments to use for sending a proposal to call setUniswapAddr(address) on the vault.
async function proposeSetBuybackUniswapAddrArgs(config) {
  const buyback = await ethers.getContract("Buyback");

  const args = await proposeArgs([
    {
      contract: buyback,
      signature: "setUniswapAddr(address)",
      args: [config.address],
    },
  ]);
  const description = "Call setUniswapAddr on buyback";
  return { args, description };
}

// Returns the arguments to use for sending a proposal to call setTrusteeFeeBps(bps) on the vault.
async function proposeSetTrusteeFeeBpsArgs(config) {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );

  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "setTrusteeFeeBps(uint256)",
      args: [config.bps],
    },
  ]);
  const description = "Call setTrusteeFeeBps";
  return { args, description };
}

// Returns the argument to use for sending a proposal to upgrade OUSD.
async function proposeUpgradeOusdArgs() {
  const ousdProxy = await ethers.getContract("OUSDProxy");
  const ousd = await ethers.getContract("OUSD");

  const args = await proposeArgs([
    {
      contract: ousdProxy,
      signature: "upgradeTo(address)",
      args: [ousd.address],
    },
  ]);
  const description = "Upgrade OUSD";
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
      args: [utils.parseUnits("1", 18)],
    },
  ]);
  const description = "Set vault buffer to 100%";
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

async function proposeSetRewardLiquidationThresholdArgs() {
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    cCompoundStrategyProxy.address
  );

  const args = await proposeArgs([
    {
      contract: cCompoundStrategy,
      signature: "setRewardLiquidationThreshold(uint256)",
      args: [utils.parseUnits("1", 18)], // 1 COMP with precision 18
    },
  ]);
  const description = "Set rewardLiquidationThreshold to 1 COMP";
  return { args, description };
}

async function proposeLockAdjusterArgs() {
  const cCompensationClaims = await ethers.getContract("CompensationClaims");

  const args = await proposeArgs([
    {
      contract: cCompensationClaims,
      signature: "lockAdjuster()",
    },
  ]);
  const description = "Lock the adjuster";
  return { args, description };
}

async function proposeUnlockAdjusterArgs() {
  const cCompensationClaims = await ethers.getContract("CompensationClaims");

  const args = await proposeArgs([
    {
      contract: cCompensationClaims,
      signature: "unlockAdjuster()",
    },
  ]);
  const description = "Unlock the adjuster";
  return { args, description };
}

async function proposeStartClaimsArgs() {
  if (!config.duration) {
    throw new Error("A duration in sec must be specified");
  }
  const cCompensationClaims = await ethers.getContract("CompensationClaims");

  const args = await proposeArgs([
    {
      contract: cCompensationClaims,
      signature: "start(uint256)",
      args: [config.duration],
    },
  ]);
  const description = "Start compensation claims";
  return { args, description };
}

// Configure the OGN Staking contract for the compensation Airdrop.
async function proposeSetAirDropRootArgs() {
  const cStakingProxy = await ethers.getContract("OGNStakingProxy");
  const cStaking = await ethers.getContractAt(
    "SingleAssetStaking",
    cStakingProxy.address
  );

  const dropStakeType = 1;
  const dropRootHash = process.env.DROP_ROOT_HASH;
  const dropProofDepth = process.env.DROP_PROOF_DEPTH;
  if (!dropRootHash) {
    throw new Error("DROP_ROOT_HASH not set");
  }
  if (!dropProofDepth) {
    throw new Error("DROP_PROOF_DEPTH not set");
  }

  const args = await proposeArgs([
    {
      contract: cStaking,
      signature: "setAirDropRoot(uint8,bytes32,uint256)",
      args: [dropStakeType, dropRootHash, dropProofDepth],
    },
  ]);
  const description = "Call setAirDropRoot on OGN Staking";
  return { args, description };
}

// Returns the argument to use for sending a proposal to set the Vault's buffer to 0.5%
// and the Compound strategy liquidation threshold to zero.
async function proposeSettingUpdatesArgs() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    cCompoundStrategyProxy.address
  );

  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "setVaultBuffer(uint256)",
      args: [utils.parseUnits("5", 15)], // set buffer to 0.5% at precision 18
    },
    {
      contract: cCompoundStrategy,
      signature: "setRewardLiquidationThreshold(uint256)",
      args: [0],
    },
  ]);
  const description = "Update Vault and Compound strategy settings";
  return { args, description };
}

async function proposeCompoundDAIArgs() {
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    cCompoundStrategyProxy.address
  );

  const args = await proposeArgs([
    {
      contract: cCompoundStrategy,
      signature: "setPTokenAddress(address,address)",
      args: [addresses.mainnet.DAI, addresses.mainnet.cDAI],
    },
  ]);
  const description = "Enable DAI on Compound strategy";
  return { args, description };
}

async function proposeWithdrawAllArgs() {
  const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  const cAaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    cAaveStrategyProxy.address
  );

  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    cCompoundStrategyProxy.address
  );

  const args = await proposeArgs([
    {
      contract: cAaveStrategy,
      signature: "withdrawAll()",
    },
    {
      contract: cCompoundStrategy,
      signature: "withdrawAll()",
    },
  ]);
  const description = "Withdraw funds from Aave and Compound";
  return { args, description };
}

async function proposeCompRewardTokenZero() {
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    cCompoundStrategyProxy.address
  );

  const args = await proposeArgs([
    {
      contract: cCompoundStrategy,
      signature: "setRewardTokenAddress(address)",
      args: [addresses.zero],
    },
  ]);
  const description = "Set Compound reward token addresss to zero";
  return { args, description };
}

async function main(config) {
  let governor;
  if (config.governorV1) {
    // V1 governor contract has a slightly different interface for the propose method which
    // takes an extra uint256[] argument compared to V2.
    const v1GovernorAddr = "0x8a5fF78BFe0de04F5dc1B57d2e1095bE697Be76E";
    const v1GovernorAbi = [
      "function propose(address[],uint256[],string[],bytes[],string) returns (uint256)",
      "function proposalCount() view returns (uint256)",
      "function queue(uint256)",
      "function execute(uint256)",
    ];
    governor = new ethers.Contract(
      v1GovernorAddr,
      v1GovernorAbi,
      ethers.provider
    );
    console.log(`Using V1 governor contract at ${v1GovernorAddr}`);
  } else {
    governor = await ethers.getContract("Governor");
  }

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
  } else if (config.setBuybackUniswapAddr) {
    console.log("setBuybackUniswapAddr proposal");
    argsMethod = proposeSetBuybackUniswapAddrArgs;
  } else if (config.setTrusteeFeeBps) {
    console.log("setTrusteeFeeBps proposal");
    argsMethod = proposeSetTrusteeFeeBpsArgs;
  } else if (config.setRebaseHookAddr) {
    console.log("setRebaseHookAddr proposal");
    argsMethod = proposeSetRebaseHookAddrArgs;
  } else if (config.upgradeOusd) {
    console.log("upgradeOusd proposal");
    argsMethod = proposeUpgradeOusdArgs;
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
  } else if (config.pauseCapital) {
    console.log("pauseCapital");
    argsMethod = proposePauseCapitalArgs;
  } else if (config.unpauseCapital) {
    console.log("unpauseCapital");
    argsMethod = proposeUnpauseCapitalArgs;
  } else if (config.unpauseRebase) {
    console.log("unpauseRebase");
    argsMethod = proposeUnpauseRebaseArgs;
  } else if (config.claimOGNStakingGovernance) {
    console.log("proposeClaimOGNStakingGovernance");
    argsMethod = proposeClaimOGNStakingGovernance;
  } else if (config.upgradeStaking) {
    console.log("upgradeStaking");
    argsMethod = proposeUpgradeStakingArgs;
  } else if (config.vaultv2Governance) {
    console.log("VaultV2Governance");
    argsMethod = proposeVaultv2GovernanceArgs;
  } else if (config.ousdNewGovernor) {
    console.log("OusdNewGovernor");
    argsMethod = proposeOusdNewGovernorArgs;
  } else if (config.ousdv2Reset) {
    console.log("Ousdv2Reset");
    argsMethod = proposeOusdv2ResetArgs;
  } else if (config.setRewardLiquidationThreshold) {
    console.log("Set Compound reward liquidation threshold");
    argsMethod = proposeSetRewardLiquidationThresholdArgs;
  } else if (config.lockAdjuster) {
    console.log("Lock adjuster on CompensationClaims");
    argsMethod = proposeLockAdjusterArgs;
  } else if (config.unlockAdjuster) {
    console.log("Unlock adjuster on CompensationClaims");
    argsMethod = proposeUnlockAdjusterArgs;
  } else if (config.startClaims) {
    console.log("Start claims on CompensationClaims");
    argsMethod = proposeStartClaimsArgs;
  } else if (config.setMaxSupplyDiff) {
    console.log("setMaxSupplyDiff");
    argsMethod = proposeSetMaxSupplyDiffArgs;
  } else if (config.setAirDropRoot) {
    console.log("setAirDropRoot");
    argsMethod = proposeSetAirDropRootArgs;
  } else if (config.proposeSettingUpdates) {
    console.log("proposeSettingUpdates");
    argsMethod = proposeSettingUpdatesArgs;
  } else if (config.withdrawAll) {
    console.log("proposeWithdrawAll");
    argsMethod = proposeWithdrawAllArgs;
  } else if (config.compoundDAI) {
    console.log("proposeCompoundDAI");
    argsMethod = proposeCompoundDAIArgs;
  } else if (config.compRewardTokenZero) {
    argsMethod = proposeCompRewardTokenZero;
  } else if (config.governorSetDelay) {
    argsMethod = proposeGovernorSetDelayArgs;
  } else {
    console.error("An action must be specified on the command line.");
    return;
  }

  const { args, description } = await argsMethod(config);

  let propArgs;
  if (config.governorV1) {
    // The V1 governor requires an extra arg compared to v2 since it is payable.
    propArgs = [args[0], [0], args[1], args[2]];
  } else {
    propArgs = args;
  }

  if (config.doIt) {
    console.log("Sending a tx calling propose() on", governor.address);
    console.log("args:", propArgs);
    let transaction;
    transaction = await governor
      .connect(sDeployer)
      .propose(...propArgs, description, await getTxOpts());
    console.log("Sent. tx hash:", transaction.hash);
    console.log("Waiting for confirmation...");
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    console.log("Propose tx confirmed");
  } else {
    console.log("Would send a tx to call propose() on", governor.address);
    console.log("args:", propArgs);
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
  duration: args["--duration"],
  address: args["--address"],
  bps: args["--bps"],
  governorV1: args["--governorV1"],
  harvest: args["--harvest"],
  setUniswapAddr: args["--setUniswapAddr"],
  setBuybackUniswapAddr: args["--setBuybackUniswapAddr"],
  setTrusteeFeeBps: args["--setTrusteeFeeBps"],
  setRebaseHookAddr: args["--setRebaseHookAddr"],
  upgradeOusd: args["--upgradeOusd"],
  upgradeVaultCore: args["--upgradeVaultCore"],
  upgradeVaultCoreAndAdmin: args["--upgradeVaultCoreAndAdmin"],
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
  prop17: args["--prop17"],
  pauseCapital: args["--pauseCapital"],
  unpauseCapital: args["--unpauseCapital"],
  unpauseRebase: args["--unpauseRebase"],
  claimOGNStakingGovernance: args["--claimOGNStakingGovernance"],
  upgradeStaking: args["--upgradeStaking"],
  vaultv2Governance: args["--vaultv2Governance"],
  ousdNewGovernor: args["--ousdNewGovernor"],
  ousdv2Reset: args["--ousdv2Reset"],
  setRewardLiquidationThreshold: args["--setRewardLiquidationThreshold"],
  lockAdjuster: args["--lockAdjuster"],
  unlockAdjuster: args["--unlockAdjuster"],
  startClaims: args["--startClaims"],
  setMaxSupplyDiff: args["--setMaxSupplyDiff"],
  setAirDropRoot: args["--setAirDropRoot"],
  proposeSettingUpdates: args["--proposeSettingUpdates"],
  withdrawAll: args["--withdrawAll"],
  compoundDAI: args["--compoundDAI"],
  compRewardTokenZero: args["--compRewardTokenZero"],
  governorSetDelay: args["--governorSetDelay"],
};

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
