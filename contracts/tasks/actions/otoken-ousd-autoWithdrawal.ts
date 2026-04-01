const { Defender } = require("@openzeppelin/defender-sdk");

exports.handler = async function (credentials) {
  const client = new Defender(credentials);

  const txRes = await client.relaySigner.sendTransaction({
    to: "0x90d588fc0eC3DB9c4b417dB4537fE08e063D2ae5",
    value: 0,
    speed: "fast",
    gasLimit: "4000000",
    data: "0x80bef06d",
  });

  console.log(txRes);
  return txRes.hash;
};

// https://defender.openzeppelin.com/#/actions/automatic/0d2bd50d-5c95-4c59-9a4b-e59363d30584
