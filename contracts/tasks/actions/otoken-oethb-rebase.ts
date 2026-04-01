const { Defender } = require("@openzeppelin/defender-sdk");

exports.handler = async function (credentials) {
  const client = new Defender(credentials);

  const txRes = await client.relaySigner.sendTransaction({
    to: "0x98a0CbeF61bD2D21435f433bE4CD42B56B38CC93",
    value: 0,
    speed: "fast",
    gasLimit: 300000,
    data: "0xaf14052c",
  });

  console.log(txRes);

  return txRes.hash;
};

// https://defender.openzeppelin.com/#/actions/automatic/7d91be37-1cdf-4481-9f79-fb1e0a43277a
