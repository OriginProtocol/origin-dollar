const addresses = require("../utils/addresses");
const { usdtUnits, daiUnits, isGanacheFork } = require("./helpers");

const daiAbi = require("./abi/dai.json").abi;
const usdtAbi = require("./abi/usdt.json").abi;

async function defaultFixture() {
  await deployments.fixture();

  const ousd = await ethers.getContract("OUSD");
  const vault = await ethers.getContract("Vault");

  let usdt, dai, oracle;
  if (isGanacheFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    dai = await ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
  } else {
    usdt = await ethers.getContract("MockUSDT");
    dai = await ethers.getContract("MockDAI");
    oracle = await ethers.getContract("MockOracle");
  }

  const signers = await ethers.getSigners();
  const matt = signers[4];
  const josh = signers[5];
  const anna = signers[6];
  const users = [matt, josh, anna];

  const binanceSigner = ethers.provider.getSigner(addresses.mainnet.Binance);

  // Give everyone USDT and DAI
  for (const user of users) {
    if (isGanacheFork) {
      // Fund from Binance account on Mainnet fork
      dai
        .connect(binanceSigner)
        .transfer(await user.getAddress(), daiUnits("1000"));
      usdt
        .connect(binanceSigner)
        .transfer(await user.getAddress(), usdtUnits("1000"));
    } else {
      usdt.connect(user).mint(usdtUnits("1000"));
      dai.connect(user).mint(daiUnits("1000"));
    }
  }

  // Matt and Josh each have $100 OUSD
  for (const user of [matt, josh]) {
    // Approve 100 USDT transfer
    await usdt.connect(user).approve(vault.address, usdtUnits("100"));
    // Mint 100 OUSD from 100 USDT
    await vault.connect(user).depositAndMint(usdt.address, usdtUnits("100"));
  }

  return {
    // Accounts
    matt,
    josh,
    anna,
    // Contracts
    ousd,
    vault,
    oracle,
    // Assets
    usdt,
    dai,
  };
}

module.exports = {
  defaultFixture,
};
