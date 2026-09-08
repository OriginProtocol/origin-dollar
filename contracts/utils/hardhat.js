const { getProvider } = require("../tasks/lib/network");

// hardhat_setCode is honoured by both the Hardhat node and Anvil, so this
// works whichever local node is attached.
const replaceContractAt = async (targetAddress, mockContract) => {
  const provider = getProvider();
  const mockCode = await provider.getCode(mockContract.address);
  await provider.send("hardhat_setCode", [targetAddress, mockCode]);
};

module.exports = {
  replaceContractAt,
};
