const addresses = require("../utils/addresses");
const {
  usdtUnits,
  daiUnits,
  usdcUnits,
  tusdUnits,
  isGanacheFork,
} = require("./helpers");

const daiAbi = require("./abi/dai.json").abi;
const usdtAbi = require("./abi/usdt.json").abi;

async function defaultFixture() {
  await deployments.fixture();

  const ousd = await ethers.getContract("OUSD");
  const vault = await ethers.getContract("Vault");
  const timelock = await ethers.getContract("Timelock");

  let usdt, dai, tusd, usdc, oracle;
  if (isGanacheFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    dai = await ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
    tusd = await ethers.getContractAt(daiAbi, addresses.mainnet.TUSD);
    usdc = await ethers.getContractAt(daiAbi, addresses.mainnet.USDC);
  } else {
    usdt = await ethers.getContract("MockUSDT");
    dai = await ethers.getContract("MockDAI");
    tusd = await ethers.getContract("MockTUSD");
    usdc = await ethers.getContract("MockUSDC");
    oracle = await ethers.getContract("MockOracle");
  }

  const signers = await ethers.getSigners();
  const governor = signers[1];
  const matt = signers[4];
  const josh = signers[5];
  const anna = signers[6];
  const users = [matt, josh, anna];

  const binanceSigner = ethers.provider.getSigner(addresses.mainnet.Binance);

  // Give everyone USDC and DAI
  for (const user of users) {
    if (isGanacheFork) {
      // Fund from Binance account on Mainnet fork
      dai
        .connect(binanceSigner)
        .transfer(await user.getAddress(), daiUnits("1000"));
      usdc
        .connect(binanceSigner)
        .transfer(await user.getAddress(), usdcUnits("1000"));
      usdt
        .connect(binanceSigner)
        .transfer(await user.getAddress(), usdtUnits("1000"));
      tusd
        .connect(binanceSigner)
        .transfer(await user.getAddress(), tusdUnits("1000"));
    } else {
      dai.connect(user).mint(daiUnits("1000"));
      usdc.connect(user).mint(usdcUnits("1000"));
      usdt.connect(user).mint(usdtUnits("1000"));
      tusd.connect(user).mint(tusdUnits("1000"));
    }
  }

  // Matt and Josh each have $100 OUSD
  for (const user of [matt, josh]) {
    // Approve 100 USDT transfer
    await dai.connect(user).approve(vault.address, daiUnits("100"));
    // Mint 100 OUSD from 100 USDT
    await vault.connect(user).depositAndMint(dai.address, daiUnits("100"));
  }

  return {
    // Accounts
    matt,
    josh,
    anna,
    governor,
    // Contracts
    ousd,
    vault,
    oracle,
    timelock,
    // Assets
    usdt,
    dai,
    tusd,
    usdc,
  };
}

module.exports = {
  defaultFixture,
};
