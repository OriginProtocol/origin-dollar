const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("defender-relay-client/lib/ethers");
const ethers = require("ethers");

const abi =
  '[{"inputs": [], "name": "rebase", "outputs": [], "stateMutability": "nonpayable", "type": "function"},{"inputs":[],"name":"collectAndRebase","outputs":[],"stateMutability":"nonpayable","type":"function"}]';

exports.handler = async function (event) {
  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: "fast" });

  const oethDripper = new ethers.Contract(
    "0xe3B3b4Fc77505EcfAACf6dD21619a8Cc12fcc501",
    abi,
    signer
  );
  const ousdVault = new ethers.Contract(
    "0xe75d77b1865ae93c7eaa3040b038d7aa7bc02f70",
    abi,
    signer
  );

  const multiplier = 1.1;

  // For oethDripper.collectAndRebase()
  let oethTx;
  try {
    const estimatedGas = await oethDripper.estimateGas.collectAndRebase();
    const bumpedGasLimit = estimatedGas
      .mul(Math.floor(multiplier * 100))
      .div(100);

    oethTx = await oethDripper.collectAndRebase({
      gasLimit: bumpedGasLimit,
    });
    console.log("OETH tx sent with gasLimit:", bumpedGasLimit.toString());
  } catch (err) {
    console.error("OETH estimation/send failed:", err);
    throw err; // or handle fallback
  }

  // For ousdVault.rebase()
  let ousdTx;
  try {
    const estimatedGas = await ousdVault.estimateGas.rebase();
    const bumpedGasLimit = estimatedGas
      .mul(Math.floor(multiplier * 100))
      .div(100);

    ousdTx = await ousdVault.rebase({
      gasLimit: bumpedGasLimit,
    });
    console.log("OUSD tx sent with gasLimit:", bumpedGasLimit.toString());
  } catch (err) {
    console.error("OUSD estimation/send failed:", err);
    throw err;
  }

  return {
    oeth: oethTx.hash,
    ousd: ousdTx.hash,
  };
};

// https://defender.openzeppelin.com/#/actions/automatic/8d3da519-c3c2-47e8-9853-07494905c470
