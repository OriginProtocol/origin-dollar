const replaceContractAt = async (targetAddress, mockContract) => {
  const signer = (await hre.ethers.getSigners())[0];
  const mockCode = await signer.provider.getCode(mockContract.address);

  await hre.network.provider.request({
    method: "hardhat_setCode",
    params: [targetAddress, mockCode],
  });
};

module.exports = {
  replaceContractAt,
};
