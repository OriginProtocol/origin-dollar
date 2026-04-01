const { Defender } = require("@openzeppelin/defender-sdk");

exports.handler = async function (credentials) {
  const client = new Defender(credentials);

  const moduleAddresses = [
    "0x15228dAE3B228175fBD9639d049265eFb08e60b6",
    "0x8e32A930CcFE108DC560eC9e630BA6b5f7E179c9",
    "0x460e4a0B14bD3F1e12f0c2194830c0204E5Bb147",
    "0xFbBb82c4F3B6f479DE1451C04A76ea80da4ff010",
    "0xAE67b612bD859378b7d0f6314E7Ee39ad4c6aBE6",
    "0x046750A8106461d9826a8Ab32890B23753A5245e",
  ];

  for (const moduleAddress of moduleAddresses) {
    const txRes = await client.relaySigner.sendTransaction({
      to: moduleAddress,
      value: 0,
      speed: "fast",
      gasLimit: "500000",
      data: "0x70bb45b3",
    });

    console.log(txRes);
  }
};

// https://defender.openzeppelin.com/#/actions/automatic/9ed4d928-ac3b-4cd5-b679-4e50e428b8f8
