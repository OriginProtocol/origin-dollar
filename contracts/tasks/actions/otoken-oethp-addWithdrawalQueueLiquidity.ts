const { Defender } = require("@openzeppelin/defender-sdk");

exports.handler = async function (credentials) {
  const client = new Defender(credentials);

  const tx = await client.relaySigner.sendTransaction({
    to: "0xc8c8F8bEA5631A8AF26440AF32a55002138cB76a",
    value: 0,
    speed: "fast",
    gasLimit: "400000",
    data: "0xb9b17f9f",
  });

  console.log(tx);
  return tx.hash;
};

// https://defender.openzeppelin.com/#/actions/automatic/4fc4372d-05b3-4e6b-ad29-8fcff117737e
