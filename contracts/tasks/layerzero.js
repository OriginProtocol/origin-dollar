// const { ethers } = require("ethers");
const { getSigner } = require("../utils/signers");
const { Options } = require("@layerzerolabs/lz-v2-utilities");
const addresses = require("../utils/addresses");

const { addressToBytes32 } = require("@layerzerolabs/lz-v2-utilities");

const endpointIds = {
  mainnet: 30101,
  arbitrum: 30110,
  base: 30184,
  plume: 30370,
};

async function lzBridgeToken(taskArguments, hre) {
  const signer = await getSigner();

  const amount = hre.ethers.utils.parseEther(taskArguments.amount);
  const destNetwork = taskArguments.destnetwork.toLowerCase();
  const endpointId = endpointIds[destNetwork];
  const srcNetwork = hre.network.name;

  const opts = Options.newOptions()
    .addExecutorLzReceiveOption(taskArguments.gaslimit || 400000, 0)
    .toBytes();

  const sendParam = {
    dstEid: endpointId,
    to: addressToBytes32(await signer.getAddress()),
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: opts,
    composeMsg: ethers.utils.arrayify("0x"),
    oftCmd: ethers.utils.arrayify("0x"),
  };

  const oftAdapter = await hre.ethers.getContractAt(
    "OmnichainL2Adapter",
    addresses[srcNetwork].WOETHOmnichainAdapter
  );

  const [nativeFee] = await oftAdapter
    .connect(signer)
    .quoteSend(sendParam, false);

  console.log(`OFT Fee: ${nativeFee}`);
}

module.exports = {
  lzBridgeToken,
};
