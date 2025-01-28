const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("@openzeppelin/defender-relay-client/lib/ethers");
const addresses = require("../../../utils/addresses");

const { SafeApiKit } = require("@safe-global/api-kit");
const { Safe } = require("@safe-global/protocol-kit");
const { OperationType } = require("@safe-global/types-kit");

const log = require("../../../utils/logger")("action:oeth:dripRateProposer");

const OETHAbi = [
  "function totalSupply() external view returns (uint256)",
  "function nonRebasingSupply() external view returns (uint256)",
];
const OETHFixedRateDripperAbi = ["function setDripRate(uint192) external"];

const TARGET_APR = 0.034;
const PERF_FEE = 0.2;

const computeDripRate = async (provider) => {
  const oeth = new ethers.Contract(
    addresses.mainnet.OETHProxy,
    OETHAbi,
    provider
  );
  const totalSupply = await oeth.totalSupply();
  const nonRebasingSupply = await oeth.nonRebasingSupply();
  const rebasingSupply = totalSupply.sub(nonRebasingSupply);

  log(`Total supply: ${totalSupply}`);
  log(`Non rebasing supply: ${nonRebasingSupply}`);
  log(`Rebasing supply: ${rebasingSupply}`);

  const dailyYield = rebasingSupply
    .mul(TARGET_APR)
    .mul((1 / (1 - PERF_FEE)).toFixed(2))
    .div(365);
  const ratePerSecond = dailyYield.div(86400);
  return ratePerSecond;
};

const proposeDripRate = async (provider, signer, ratePerSecond) => {
  const apiKit = new SafeApiKit({
    chainId: "1",
  });

  const safe = await Safe.init({
    provider: provider,
    signer: signer,
    safeAddress: addresses.multichainStrategist,
  });

  const dripper = new ethers.Contract(
    addresses.mainnet.OETHFixedRateDripper,
    OETHFixedRateDripperAbi,
    signer
  );
  const encodedTx = dripper.interface.encodeFunctionData(
    "setDripRate(uint192)",
    [ratePerSecond]
  );

  const txData = {
    to: addresses.mainnet.OETHFixedRateDripper,
    value: "0",
    data: encodedTx,
    operation: OperationType.Call,
  };

  const safeTx = await safe.createTransaction({
    transactions: [txData],
  });

  const safeTxHash = await safe.getTransactionHash(safeTx);
  const signature = await safe.signHash(safeTxHash);

  await apiKit.proposeTransaction({
    safeAddress: addresses.multichainStrategist,
    safeTransactionData: safeTx.data,
    safeTxHash,
    senderAddress: signer.address,
    senderSignature: signature.data,
  });

  log(`Transaction proposed: ${safeTxHash}`);
};

const handler = async (event) => {
  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: "fastest" });

  // Make sure network is mainnet
  const network = await provider.getNetwork();
  if (network.chainId !== 1) {
    throw new Error("Network is not mainnet");
  }

  const targetRate = await computeDripRate(provider);
  log(`Target rate: ${targetRate}`);

  await proposeDripRate(provider, signer, targetRate);
};

module.exports = { handler };
