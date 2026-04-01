const { Defender } = require("@openzeppelin/defender-sdk");

exports.handler = async function (credentials) {
  const client = new Defender(credentials);

  const txRes = await client.relaySigner.sendTransaction({
    to: "0xE0228DB13F8C4Eb00fD1e08e076b09eF5cD0EA1e",
    value: 0,
    speed: "fast",
    gasLimit: "1000000",
    // sendBalanceUpdate()
    data: "0x3335ad7f",
  });

  console.log(txRes);
  return txRes.hash;
};
