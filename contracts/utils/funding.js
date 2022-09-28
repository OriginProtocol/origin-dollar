const hre = require("hardhat");
const { utils } = require("ethers");

const addresses = require("./addresses");
const daiAbi = require("../test/abi/dai.json").abi;
const usdtAbi = require("../test/abi/usdt.json").abi;
const tusdAbi = require("../test/abi/erc20.json");
const usdcAbi = require("../test/abi/erc20.json");
const ognAbi = require("../test/abi/erc20.json");

const {
  usdtUnits,
  daiUnits,
  usdcUnits,
  tusdUnits,
  ognUnits,
  isFork,
} = require("../test/helpers");

/* Used for funding accounts in forked mode. Find the holder that has the most ETH or ERC20 token amounts.
 * param contract: address of ERC20 token. If null the account with the most ETH shall be returned
 *
 * returns signer object of the most appropriate token/ETH holder
 */
const findBestMainnetTokenHolder = async (contract, hre) => {
  const binanceAddresses = addresses.mainnet.BinanceAll.split(",");
  const { isFork } = require("../test/helpers");

  const binanceSigners = await Promise.all(
    binanceAddresses.map((binanceAddress) => {
      return hre.ethers.provider.getSigner(binanceAddress);
    })
  );

  if (isFork) {
    await Promise.all(
      binanceAddresses.map(async (binanceAddress) => {
        return hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [binanceAddress],
        });
      })
    );
  }

  let balances = await Promise.all(
    binanceSigners.map(async (binanceSigner) => {
      if (!contract) {
        return await hre.ethers.provider.getBalance(binanceSigner._address);
      }

      return await contract
        .connect(binanceSigner)
        .balanceOf(binanceSigner._address);
    })
  );

  let largestBalance = balances[0];
  let largestBalanceIndex = 0;
  for (let i = 0; i < balances.length; i++) {
    if (balances[i].gte(largestBalance)) {
      largestBalance = balances[i];
      largestBalanceIndex = i;
    }
  }

  return binanceSigners[largestBalanceIndex];
};

const fundAccounts = async () => {
  let usdt, dai, tusd, usdc, nonStandardToken;
  if (isFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    dai = await ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
    tusd = await ethers.getContractAt(tusdAbi, addresses.mainnet.TUSD);
    usdc = await ethers.getContractAt(usdcAbi, addresses.mainnet.USDC);
    ogn = await ethers.getContractAt(ognAbi, addresses.mainnet.OGN);
  } else {
    usdt = await ethers.getContract("MockUSDT");
    dai = await ethers.getContract("MockDAI");
    tusd = await ethers.getContract("MockTUSD");
    usdc = await ethers.getContract("MockUSDC");
    ogn = await ethers.getContract("MockOGN");
    nonStandardToken = await ethers.getContract("MockNonStandardToken");
  }

  let binanceSigner;
  const signers = await hre.ethers.getSigners();
  const { governorAddr } = await getNamedAccounts();

  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.mainnet.Binance],
    });
    binanceSigner = await ethers.provider.getSigner(addresses.mainnet.Binance);
  }

  const addressPromises = new Array(10)
    .fill(0)
    .map((_, i) => signers[i].getAddress());
  const signerAddresses = await Promise.all(addressPromises);

  for (const address of signerAddresses) {
    if (isFork) {
      await hre.network.provider.send("hardhat_setBalance", [
        address,
        utils.parseEther("1000000").toHexString(),
      ]);

      await dai.connect(binanceSigner).transfer(address, daiUnits("1000000"));
      await usdc.connect(binanceSigner).transfer(address, usdcUnits("1000000"));
      await usdt.connect(binanceSigner).transfer(address, usdtUnits("1000000"));
      await tusd.connect(binanceSigner).transfer(address, tusdUnits("1000000"));
      await ogn.connect(binanceSigner).transfer(address, ognUnits("1000000"));
    } else {
      const signer = await ethers.provider.getSigner(address);
      await dai.connect(signer).mint(daiUnits("1000"));
      await usdc.connect(signer).mint(usdcUnits("1000"));
      await usdt.connect(signer).mint(usdtUnits("1000"));
      await tusd.connect(signer).mint(tusdUnits("1000"));
      await ogn.connect(signer).mint(ognUnits("1000"));
      await nonStandardToken.connect(signer).mint(usdtUnits("1000"));
    }
  }

  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [addresses.mainnet.Binance],
    });
  }
};

module.exports = {
  fundAccounts,
  findBestMainnetTokenHolder,
};
