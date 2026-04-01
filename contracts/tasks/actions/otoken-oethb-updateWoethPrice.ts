const { Defender } = require("@openzeppelin/defender-sdk");

exports.handler = async function (credentials) {
  const client = new Defender(credentials);

  const txRes = await client.relaySigner.sendTransaction({
    to: "0x80c864704DD06C3693ed5179190786EE38ACf835",
    value: 0,
    speed: "fast",
    gasLimit: "200000",
    data: "0x6c713833",
  });

  console.log(txRes);
  return txRes.hash;
};

// https://defender.openzeppelin.com/#/actions/automatic/55082b52-4878-450c-8b5e-918bf7e27dc4
