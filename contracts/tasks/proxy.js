const { ethereumAddress } = require("../utils/regex");
const { getSigner } = require("../utils/signers");

const log = require("../utils/logger")("task:proxy");

async function proxyUpgrades({ contract, from, to }, hre) {
  const toBlockNumber = to || (await hre.ethers.provider.getBlockNumber());

  log(`Searching for Upgraded events from ${from} to ${toBlockNumber}`);

  const signer = await getSigner();

  const proxy = contract.match(ethereumAddress)
    ? await hre.ethers.getContractAt(
        "InitializeGovernedUpgradeabilityProxy",
        contract
      )
    : await hre.ethers.getContract(contract);

  const filter = await proxy.filters.Upgraded();
  const logs = await proxy
    .connect(signer)
    .queryFilter(filter, from, toBlockNumber);

  logs.forEach((eventLog) => {
    console.log(
      `Upgraded at block ${eventLog.blockNumber} to ${eventLog.args.implementation} in tx ${eventLog.transactionHash}`
    );
  });
}

module.exports = {
  proxyUpgrades,
};
