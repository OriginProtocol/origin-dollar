const { BigNumber } = require("ethers");
const { formatUnits } = require("ethers/lib/utils");
const addresses = require("./addresses");
const { getBlock } = require("../tasks/block");

const morphoV1VaultAbi = require("../abi/morphoV1Vault.json");
const { resolveContract } = require("./resolvers");

const log = require("../utils/logger")("utils:morpho");

async function canWithdrawAllFromMorphoOUSD() {
  const shortfall = await morphoWithdrawShortfall();
  return shortfall.isZero();
}

async function morphoWithdrawShortfall() {
  const morphoOUSDv1Vault = await ethers.getContractAt(
    morphoV1VaultAbi,
    addresses.mainnet.MorphoOUSDv1Vault
  );

  const morphoOUSDv2Strategy = await resolveContract(
    "OUSDMorphoV2StrategyProxy",
    "Generalized4626Strategy"
  );

  const maxWithdrawal = await morphoOUSDv1Vault.maxWithdraw(
    addresses.mainnet.MorphoOUSDv2Adaptor
  );

  // check all funds can be withdrawn from the Morpho OUSD v2 Strategy
  const strategyUSDCBalance = await morphoOUSDv2Strategy.checkBalance(
    addresses.mainnet.USDC
  );

  log(
    `Morpho OUSD v2 Strategy USDC balance: ${formatUnits(
      strategyUSDCBalance,
      6
    )}`
  );
  log(
    `Max withdraw from underlying Morpho OUSD v1 Vault: ${formatUnits(
      maxWithdrawal,
      6
    )}`
  );

  if (maxWithdrawal.lt(strategyUSDCBalance)) {
    const shortfall = strategyUSDCBalance.sub(maxWithdrawal);
    log(
      `Not enough liquidity in Morpho OUSD Vault to withdrawAll. Short ${formatUnits(
        shortfall,
        6
      )} USDC`
    );
    return shortfall;
  }

  return BigNumber.from(0);
}

async function snapMorpho({ block }) {
  let blockTag = await getBlock(block);

  const morphoOUSDv1Vault = await ethers.getContractAt(
    morphoV1VaultAbi,
    addresses.mainnet.MorphoOUSDv1Vault
  );

  const morphoOUSDv2Strategy = await resolveContract(
    "OUSDMorphoV2StrategyProxy",
    "Generalized4626Strategy"
  );

  const maxWithdrawal = await morphoOUSDv1Vault.maxWithdraw(
    addresses.mainnet.MorphoOUSDv2Adaptor,
    { blockTag }
  );

  // check all funds can be withdrawn from the Morpho OUSD v2 Strategy
  const strategyUSDCBalance = await morphoOUSDv2Strategy.checkBalance(
    addresses.mainnet.USDC,
    { blockTag }
  );

  console.log(
    `Strategy balance                : ${formatUnits(
      strategyUSDCBalance,
      6
    )} USDC`
  );
  console.log(
    `Max withdrawable from underlying: ${formatUnits(maxWithdrawal, 6)} USDC`
  );

  const shortfall = maxWithdrawal.lt(strategyUSDCBalance)
    ? strategyUSDCBalance.sub(maxWithdrawal)
    : BigNumber.from(0);

  const shortfallPercent = shortfall
    .mul(BigNumber.from(10000))
    .div(strategyUSDCBalance);

  console.log(
    `Withdraw shortfall              : ${formatUnits(
      shortfall,
      6
    )} USDC (${formatUnits(shortfallPercent, 2)}%)`
  );
}

module.exports = {
  canWithdrawAllFromMorphoOUSD,
  morphoWithdrawShortfall,
  snapMorpho,
};
