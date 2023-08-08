const bytes = /^0x([A-Fa-f0-9]{1,})$/;

const bytesFixed = (x) => new RegExp(`^0x([A-Fa-f0-9]{${x * 2}})$`);

const bytes32 = bytesFixed(32);
const ethereumAddress = bytesFixed(20);
const transactionHash = bytes32;

const privateKey = /^[A-Fa-f0-9]{1,64}$/;

module.exports = {
  bytes,
  bytesFixed,
  bytes32,
  ethereumAddress,
  transactionHash,
  privateKey,
};
