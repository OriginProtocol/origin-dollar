const { Defender } = require("@openzeppelin/defender-sdk");

exports.handler = async function (credentials) {
  const client = new Defender(credentials);

  const txRes = await client.relaySigner.sendTransaction({
    to: "0x0CbEAcf86232fC04050cD679d860516F7254c22E",
    value: 0,
    speed: "fast",
    gasLimit: "800000",
    data: "0xb8a02d04000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000020000000000000000000000009cfcaf81600155e01c63e4d2993a8a81a8205829000000000000000000000000f611cc500eee7e4e4763a05fe623e2363c86d2af",
  });

  console.log(txRes);

  return txRes.hash;
};

// https://defender.openzeppelin.com/#/actions/automatic/e54e88e8-c9d3-4172-a6e4-686b276106b0
