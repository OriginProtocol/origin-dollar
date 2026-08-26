const ethers = require("ethers");
const addresses = require("./addresses");
const { logTxDetails } = require("./txLogger");

const claimRewardsSafeModuleAbi = require("../abi/claim-rewards-module.json");

const log = require("./logger")("task:harvest");

const harvestMorphoStrategies = async (signer) => {
  const strategies = [
    // Morpho OUSD v2 Strategy
    "0x3643cafa6ef3dd7fcc2adad1cabf708075afff6e",
  ];

  log("Collecting Morpho Strategies rewards");
  for (const strategy of strategies) {
    const distributions = await fetch(
      `https://rewards.morpho.org/v1/users/${strategy}/distributions`
    );
    const distributionsData = await distributions.json();
    for (const data of distributionsData.data) {
      const distributor = data.distributor.address;
      log(`Distributor: ${distributor}`);
      log(`txData: ${data.tx_data}`);

      await signer.sendTransaction({
        to: distributor,
        data: data.tx_data,
        value: 0,
        gasLimit: 1000000,
        speed: "fastest",
      });
    }
  }
};

const claimStrategyRewards = async (signer) => {
  log("Invoking claim from safe module");
  const safeModule = new ethers.Contract(
    addresses.mainnet.ClaimStrategyRewardsSafeModule,
    claimRewardsSafeModuleAbi,
    signer
  );

  const safeModuleTx = await safeModule.connect(signer).claimRewards(true, {
    gasLimit: 2500000,
  });
  await logTxDetails(safeModuleTx, `claimRewards`);
};

module.exports = {
  harvestMorphoStrategies,
  claimStrategyRewards,
};
