const { Defender } = require("@openzeppelin/defender-sdk");

exports.handler = async function (credentials) {
  const client = new Defender(credentials);

  // Rebase on the Vault
  const txRes = await client.relaySigner.sendTransaction({
    to: "0xa3c0eca00d2b76b4d1f170b0ab3fdea16c180186",
    value: 0,
    speed: "fast",
    gasLimit: "400000",
    data: "0xaf14052c",
  });
  console.log(txRes);

  // Harvet and transfer
  const harvestTx = await client.relaySigner.sendTransaction({
    to: "0x7B0383b31C7662E3f6B6E9C743Bc87b93C1f4498",
    value: 0,
    speed: "fast",
    gasLimit: "400000",
    data: "0x08765741000000000000000000000000be19cc5654e30daf04ad3b5e06213d70f4e882ee",
  });
  console.log(harvestTx);

  return txRes.hash;
};

// https://defender.openzeppelin.com/#/actions/automatic/f558b0a0-45d5-4a7e-b0a8-c6fa8b3c19e5
