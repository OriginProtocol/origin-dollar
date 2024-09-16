const { formatUnits } = require("ethers").utils;
const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:simulation");

const deployForceEtherSender = async () => {
  const signer = await getSigner();

  log(`About to deploy the ForceEtherSender contract`);

  // Get the contract factory
  const ForceEtherSenderFactory = await ethers.getContractFactory(
    "ForceEtherSender",
    signer
  );

  // Deploy the contract with an initial message
  const forceEtherSender = await ForceEtherSenderFactory.deploy();

  // Wait for the contract to be deployed
  await forceEtherSender.deployed();

  log("ForceEtherSender contract deployed to:", forceEtherSender.address);
};

const forceSend = async ({ sender, recipient }) => {
  const signer = await getSigner();
  const balance = await ethers.provider.getBalance(sender);
  log(`About to forceSend ${formatUnits(balance)} ETH to ${recipient}`);

  const forceEtherSender = await ethers.getContractAt(
    "ForceEtherSender",
    sender
  );
  const tx = await forceEtherSender.connect(signer).forceSend(recipient);
  await logTxDetails(tx, "forceSend");
};

module.exports = {
  deployForceEtherSender,
  forceSend,
};
