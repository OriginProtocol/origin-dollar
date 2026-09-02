const { getProvider } = require("../tasks/lib/network");

const replaceContractAt = async (targetAddress, mockContract) => {
  const provider = getProvider();
  const mockCode = await provider.getCode(mockContract.address);
  await provider.send("anvil_setCode", [targetAddress, mockCode]);
};

module.exports = {
  replaceContractAt,
};
