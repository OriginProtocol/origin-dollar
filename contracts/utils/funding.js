const hre = require("hardhat");

const addresses = require("./addresses");
const usdsAbi = require("../test/abi/usds.json").abi;
const usdtAbi = require("../test/abi/usdt.json").abi;
const tusdAbi = require("../test/abi/erc20.json");
const usdcAbi = require("../test/abi/erc20.json");
const ognAbi = require("../test/abi/erc20.json");

const {
  usdtUnits,
  usdsUnits,
  usdcUnits,
  tusdUnits,
  ognUnits,
  oethUnits,
  isFork,
} = require("../test/helpers");
const { hardhatSetBalance, setERC20TokenBalance } = require("../test/_fund");

// const log = require("./logger")("utils:funding");

const fundAccountsForOETHUnitTests = async () => {
  if (isFork) {
    return;
  }

  let weth; // rETH, stETH, frxETH, sfrxETH;

  weth = await ethers.getContractAt("MockWETH", addresses.mainnet.WETH);
  // rETH = await ethers.getContract("MockRETH");
  // stETH = await ethers.getContract("MockstETH");
  // frxETH = await ethers.getContract("MockfrxETH");
  // sfrxETH = await ethers.getContract("MocksfrxETH");

  const signers = await hre.ethers.getSigners();

  const addressPromises = new Array(10)
    .fill(0)
    .map((_, i) => signers[i].getAddress());
  const signerAddresses = await Promise.all(addressPromises);

  for (const address of signerAddresses) {
    const signer = await ethers.provider.getSigner(address);
    await weth.connect(signer).mint(oethUnits("1000"));
    // await rETH.connect(signer).mint(oethUnits("1000"));
    // await stETH.connect(signer).mint(oethUnits("1000"));
    // await frxETH.connect(signer).mint(oethUnits("1000"));
    // await sfrxETH.connect(signer).mint(oethUnits("1000"));
  }
};

const fundAccounts = async () => {
  let usdt, usds, usdc, nonStandardToken, ogn, weth;
  // tusd,
  // rETH,
  // stETH,
  // frxETH,
  // sfrxETH;
  if (isFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    usds = await ethers.getContractAt(usdsAbi, addresses.mainnet.USDS);
    // tusd = await ethers.getContractAt(tusdAbi, addresses.mainnet.TUSD);
    usdc = await ethers.getContractAt(usdcAbi, addresses.mainnet.USDC);
    ogn = await ethers.getContractAt(ognAbi, addresses.mainnet.OGN);

    weth = await ethers.getContractAt(usdsAbi, addresses.mainnet.WETH);
    // rETH = await ethers.getContractAt(usdsAbi, addresses.mainnet.rETH);
    // stETH = await ethers.getContractAt(usdsAbi, addresses.mainnet.stETH);
    // frxETH = await ethers.getContractAt(usdsAbi, addresses.mainnet.frxETH);
  } else {
    usdt = await ethers.getContract("MockUSDT");
    usds = await ethers.getContract("MockUSDS");
    usdc = await ethers.getContract("MockUSDC");
    ogn = await ethers.getContract("MockOGN");

    weth = await ethers.getContractAt("MockWETH", addresses.mainnet.WETH);
    // rETH = await ethers.getContract("MockRETH");
    // stETH = await ethers.getContract("MockstETH");
    // frxETH = await ethers.getContract("MockfrxETH");
    // sfrxETH = await ethers.getContract("MocksfrxETH");

    nonStandardToken = await ethers.getContract("MockNonStandardToken");
  }

  const ousdCoins = [usds, usdc, usdt, ogn]; // tusd
  const oethCoins = [weth]; // rETH, stETH, frxETH
  const skipOUSDCoins = process.env.SKIP_OUSD_COINS == "true";
  const skipOETHCoins = process.env.SKIP_OETH_COINS == "true";
  let allCoins = [];
  if (!skipOUSDCoins) {
    allCoins = [...allCoins, ...ousdCoins];
  }
  if (!skipOETHCoins) {
    allCoins = [...allCoins, ...oethCoins];
  }
  const signers = await hre.ethers.getSigners();

  for (const signer of signers) {
    const signerAddress = await signer.getAddress();
    if (isFork) {
      // Give ETH to user
      await hardhatSetBalance(signerAddress, "1000000");

      for (const tokenContract of allCoins) {
        await setERC20TokenBalance(
          signerAddress,
          tokenContract,
          "1000000",
          hre
        );
      }
    } else {
      await usds.connect(signer).mint(usdsUnits("1000"));
      await usdc.connect(signer).mint(usdcUnits("1000"));
      await usdt.connect(signer).mint(usdtUnits("1000"));
      // await tusd.connect(signer).mint(tusdUnits("1000"));
      await ogn.connect(signer).mint(ognUnits("1000"));
      await nonStandardToken.connect(signer).mint(usdtUnits("1000"));
    }
  }
};

module.exports = {
  fundAccounts,
  fundAccountsForOETHUnitTests,
};
