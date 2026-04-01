const { Defender } = require("@openzeppelin/defender-sdk");

exports.handler = async function (credentials) {
  const client = new Defender(credentials);

  const txRes = await client.relaySigner.sendTransaction({
    to: "0xB1d624fc40824683e2bFBEfd19eB208DbBE00866",
    value: 0,
    speed: "fast",
    gasLimit: "1000000",
    // sendBalanceUpdate()
    data: "0x3335ad7f",
  });

  console.log(txRes);
  return txRes.hash;
};

// https://defender.openzeppelin.com/#/actions/automatic/8267c40e-825b-4b61-a339-fc9acef02acb
