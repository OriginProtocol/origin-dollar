const { parseEther } = require("ethers/lib/utils");

const replaceContractAt = async (targetAddress, mockContract) => {
  const signer = (await hre.ethers.getSigners())[0];
  const mockCode = await signer.provider.getCode(mockContract.address);

  await hre.network.provider.request({
    method: "hardhat_setCode",
    params: [targetAddress, mockCode],
  });
};

async function hardhatSetBalance(address, amount = "10000") {
  await hre.network.provider.request({
    method: "hardhat_setBalance",
    params: [
      address,
      parseEther(amount)
        .toHexString()
        .replace(/^0x0+/, "0x")
        .replace(/0$/, "1"),
    ],
  });
}

module.exports = {
  replaceContractAt,
  hardhatSetBalance,
};
