const bre = require("@nomiclabs/buidler");

const addresses = require("../utils/addresses");
const {
  usdtUnits,
  daiUnits,
  usdcUnits,
} = require("../test/helpers");

const daiAbi = require("../test/abi/dai.json").abi;
const usdtAbi = require("../test/abi/usdt.json").abi;
const usdcAbi = require("../test/abi/erc20.json");

const grantStableCoins = async () => {
  let usdt, dai, usdc, oracle, nonStandardToken;
  usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
  dai = await ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
  usdc = await ethers.getContractAt(usdcAbi, addresses.mainnet.USDC);

  const binanceSigner = await ethers.provider.getSigner(
    addresses.mainnet.Binance
  );

  const signers = await bre.ethers.getSigners();
  signers.forEach(async user => {
    await dai
      .connect(binanceSigner)
      .transfer("0x17BAd8cbCDeC350958dF0Bfe01E284dd8Fec3fcD", daiUnits("10000"));
    await usdc
      .connect(binanceSigner)
      .transfer("0x17BAd8cbCDeC350958dF0Bfe01E284dd8Fec3fcD", usdcUnits("10000"));
    await usdt
      .connect(binanceSigner)
      .transfer("0x17BAd8cbCDeC350958dF0Bfe01E284dd8Fec3fcD", usdtUnits("10000"));
  })
}

grantStableCoins()