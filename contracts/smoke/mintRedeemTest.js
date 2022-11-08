const { fund, mint } = require("../tasks/account");
const {
  usdtUnits,
  ousdUnits,
  usdcUnits,
  daiUnits,
  ousdUnitsFormat,
  isWithinTolerance,
} = require("../test/helpers");
const addresses = require("../utils/addresses");
const erc20Abi = require("../test/abi/erc20.json");

let utils, BigNumber, usdt, dai, usdc, ousd, vault, signer, signer2;

async function fundAccount4(hre) {
  await fund(
    {
      num: 1,
      amount: "3000",
    },
    hre
  );
}

const getUsdtBalance = async () => {
  return await usdt.connect(signer).balanceOf(signer.address);
};

const getDaiBalance = async () => {
  return await dai.connect(signer).balanceOf(signer.address);
};

const getUsdcBalance = async () => {
  return await usdc.connect(signer).balanceOf(signer.address);
};

const getOusdBalance = async (signer) => {
  return await ousd.connect(signer).balanceOf(signer.address);
};

const assertExpectedOusd = (bigNumber, bigNumberExpected, tolerance = 0.03) => {
  if (!isWithinTolerance(bigNumber, bigNumberExpected, 0.03)) {
    throw new Error(
      `Unexpected OUSD value. Expected ${ousdUnitsFormat(
        bigNumberExpected
      )} with the tolerance of ${tolerance}. Received: ${ousdUnitsFormat(
        bigNumber
      )}`
    );
  }
};

const assertExpectedStablecoins = (
  usdtBn,
  daiBn,
  usdcBn,
  unitsExpected,
  tolerance = 0.03
) => {
  // adjust decimals of all stablecoins to 18 so they are easier to compare
  const adjustedUsdt = usdtBn.mul(BigNumber.from("1000000000000"));
  const adjustedUsdc = usdcBn.mul(BigNumber.from("1000000000000"));
  const allStablecoins = adjustedUsdt.add(adjustedUsdc).add(daiBn);
  const stableCoinsExpected = utils.parseUnits(unitsExpected, 18);

  if (!isWithinTolerance(allStablecoins, stableCoinsExpected, 0.03)) {
    throw new Error(
      `Unexpected value. Expected to receive total stablecoin units ${ousdUnitsFormat(
        stableCoinsExpected
      )} with the tolerance of ${tolerance}. Received: ${ousdUnitsFormat(
        allStablecoins
      )}`
    );
  }
};

async function setup(hre) {
  utils = hre.ethers.utils;
  BigNumber = hre.ethers.BigNumber;
  ousd = await hre.ethers.getContractAt("OUSD", addresses.mainnet.OUSDProxy);
  usdt = await hre.ethers.getContractAt(erc20Abi, addresses.mainnet.USDT);
  dai = await hre.ethers.getContractAt(erc20Abi, addresses.mainnet.DAI);
  usdc = await hre.ethers.getContractAt(erc20Abi, addresses.mainnet.USDC);
  vault = await ethers.getContractAt("IVault", addresses.mainnet.VaultProxy);
  signer = (await hre.ethers.getSigners())[4];
  signer2 = (await hre.ethers.getSigners())[5];

  await fundAccount4(hre);
}

async function beforeDeploy(hre) {
  // fund stablecoins to the 4th account in signers
  await setup(hre);

  const usdtBeforeMint = await getUsdtBalance();
  const ousdBeforeMint = await getOusdBalance(signer);
  const usdtToMint = "1100";
  await mint(
    {
      num: 1,
      amount: usdtToMint,
    },
    hre
  );

  const usdtAfterMint = await getUsdtBalance();
  const ousdAfterMint = await getOusdBalance(signer);

  const expectedUsdt = usdtBeforeMint.sub(usdtUnits(usdtToMint));
  if (!usdtAfterMint.eq(expectedUsdt)) {
    throw new Error(
      `Incorrect usdt value. Got ${usdtAfterMint.toString()} expected: ${expectedUsdt.toString()}`
    );
  }

  const expectedOusd = ousdBeforeMint.add(ousdUnits(usdtToMint));
  assertExpectedOusd(ousdAfterMint, expectedOusd);

  return {
    ousdBeforeMint,
    ousdAfterMint,
  };
}

const testMint = async (hre, beforeDeployData) => {
  const ousdBeforeMint = await getOusdBalance(signer);
  await mint(
    {
      num: 1,
      amount: "500",
    },
    hre
  );

  const ousdAfterMint = await getOusdBalance(signer);

  if (!beforeDeployData.ousdAfterMint.eq(ousdBeforeMint)) {
    throw new Error(
      `Deploy changed the amount of ousd in user's account from ${ousdUnitsFormat(
        beforeDeployData.ousdAfterMint
      )} to ${ousdUnitsFormat(ousdBeforeMint)}`
    );
  }

  return ousdAfterMint;
};

const testRedeem = async (ousdAfterMint) => {
  const usdtBeforeRedeem = await getUsdtBalance();
  const daiBeforeRedeem = await getDaiBalance();
  const usdcBeforeRedeem = await getUsdcBalance();

  const unitsToRedeem = "800";
  const ousdToRedeem = ousdUnits(unitsToRedeem);
  await vault.connect(signer).redeem(ousdToRedeem, ousdUnits("770"));

  const ousdAfterRedeem = await getOusdBalance(signer);
  const usdtAfterRedeem = await getUsdtBalance();
  const daiAfterRedeem = await getDaiBalance();
  const usdcAfterRedeem = await getUsdcBalance();

  const expectedOusd = ousdAfterMint.sub(ousdToRedeem);
  assertExpectedOusd(ousdAfterRedeem, expectedOusd, 0.0);

  assertExpectedStablecoins(
    usdtAfterRedeem.sub(usdtBeforeRedeem),
    daiAfterRedeem.sub(daiBeforeRedeem),
    usdcAfterRedeem.sub(usdcBeforeRedeem),
    "800"
  );
};

const testTransfer = async () => {
  const ousdSenderBeforeSend = await getOusdBalance(signer);
  const ousdReceiverBeforeSend = await getOusdBalance(signer2);
  const ousdToTransfer = "245.5";

  await ousd
    .connect(signer)
    .transfer(signer2.address, ousdUnits(ousdToTransfer));

  const ousdSenderAfterSend = await getOusdBalance(signer);
  const ousdReceiverAfterSend = await getOusdBalance(signer2);

  assertExpectedOusd(
    ousdSenderAfterSend,
    ousdSenderBeforeSend.sub(ousdUnits(ousdToTransfer)),
    0.0
  );
  assertExpectedOusd(
    ousdReceiverAfterSend,
    ousdReceiverBeforeSend.add(ousdUnits(ousdToTransfer)),
    0.0
  );
};

async function afterDeploy(hre, beforeDeployData) {
  const ousdAfterMint = await testMint(hre, beforeDeployData);
  await testRedeem(ousdAfterMint);
  await testTransfer();
}

module.exports = {
  beforeDeploy,
  afterDeploy,
};
