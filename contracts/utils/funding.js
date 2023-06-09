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

const log = require("./logger")("utils:funding");

/* Used for funding accounts in forked mode. Find the holder that has the most ETH or ERC20 token amounts.
 * param contract: address of ERC20 token. If null the account with the most ETH shall be returned
 *
 * returns signer object of the most appropriate token/ETH holder
 */
const findBestMainnetTokenHolder = async (contract, hre) => {
  const whaleAddresses = [
    ...addresses.mainnet.BinanceAll.split(","),
    ...addresses.mainnet.WhaleAddresses.split(","),
  ];
  const { isFork } = require("../test/helpers");

  const whaleSigners = await Promise.all(
    whaleAddresses.map((binanceAddress) => {
      return hre.ethers.provider.getSigner(binanceAddress);
    })
  );

  if (isFork) {
    await Promise.all(
      whaleAddresses.map(async (binanceAddress) => {
        return hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [binanceAddress],
        });
      })
    );
  }

  let balances = await Promise.all(
    whaleSigners.map(async (binanceSigner) => {
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

  return whaleSigners[largestBalanceIndex];
};

const findBestMainnetTokenHolderAndImpersonate = async (contract, hre) => {
  const signer = await findBestMainnetTokenHolder(contract, hre);
  const address = await signer.getAddress();

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
  await hre.network.provider.send("hardhat_setBalance", [
    address,
    utils.parseEther("1000000").toHexString(),
  ]);
  return signer;
};

const fundAccounts = async () => {
  let usdt, dai, tusd, usdc, nonStandardToken, ogn, weth, rETH, stETH, frxETH;
  if (isFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    dai = await ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
    tusd = await ethers.getContractAt(tusdAbi, addresses.mainnet.TUSD);
    usdc = await ethers.getContractAt(usdcAbi, addresses.mainnet.USDC);
    ogn = await ethers.getContractAt(ognAbi, addresses.mainnet.OGN);

    weth = await ethers.getContractAt(daiAbi, addresses.mainnet.WETH);
    rETH = await ethers.getContractAt(daiAbi, addresses.mainnet.rETH);
    stETH = await ethers.getContractAt(daiAbi, addresses.mainnet.stETH);
    frxETH = await ethers.getContractAt(daiAbi, addresses.mainnet.frxETH);
  } else {
    usdt = await ethers.getContract("MockUSDT");
    dai = await ethers.getContract("MockDAI");
    tusd = await ethers.getContract("MockTUSD");
    usdc = await ethers.getContract("MockUSDC");
    ogn = await ethers.getContract("MockOGN");
    nonStandardToken = await ethers.getContract("MockNonStandardToken");
  }

  const ousdCoins = [dai, usdc, usdt, tusd, ogn];
  const oethCoins = [weth, rETH, stETH, frxETH];
  const allCoins = [...ousdCoins, ...oethCoins];

  const signers = await hre.ethers.getSigners();

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

      for (const tokenContract of allCoins) {
        const signer = await findBestMainnetTokenHolderAndImpersonate(
          tokenContract,
          hre
        );
        // If the token is USD, transfer 1M, otherwise 1K
        const amount = ousdCoins.includes(tokenContract) ? "1000000" : "1000";
        await tokenContract
          .connect(signer)
          .transfer(
            address,
            utils.parseUnits(amount, await tokenContract.decimals())
          );
        log(
          `funded ${amount} ${await tokenContract.symbol()} from signer ${await signer.getAddress()} to ${address}`
        );
      }
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
