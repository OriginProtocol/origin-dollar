// Script to check contracts have been properly deployed and configured.
//
// Usage:
//  - Setup your environment:
//         setup fork see readme
//         export BUIDLER_NETWORK=fork
//  - Then run:
//      node checkDeploy.js

const { ethers, getNamedAccounts } = require("@nomiclabs/buidler");
const { utils } = require("ethers");
const { formatUnits } = utils;
const { getTxOpts } = require("../../utils/tx");
const addresses = require("../../utils/addresses");
const ERC20Abi = require("../../test/abi/erc20.json");

const {
  usdtUnits,
  daiUnits,
  usdcUnits,
  tusdUnits,
  ognUnits,
  isGanacheFork,
} = require("../../test/helpers");

async function main() {
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // in a fork env these guys should have a good amount of OGN and USDT/USDC
  const signers = await ethers.getSigners();

  usdt = await ethers.getContractAt(ERC20Abi, addresses.mainnet.USDT);
  usdc = await ethers.getContractAt(ERC20Abi, addresses.mainnet.USDC);
  ogn = await ethers.getContractAt(ERC20Abi, addresses.mainnet.OGN);

  const liquidityProxy = await ethers.getContract(
    "LiquidityRewardOUSD_USDTProxy"
  );
  const liquidityContract = await ethers.getContractAt(
    "LiquidityReward",
    liquidityProxy.address
  );

  // fund the liquidity contract with 1000 ogn
  ogn.connect(signers[0]).transfer(liquidityContract.address, ognUnits("1000"));

  await liquidityContract
    .connect(sGovernor) // Claim governance with governor
    .claimGovernance(await getTxOpts());

  // at 0.1 rate we have enough for 10,000 blocks given we fund it with 1000
  const rate = utils.parseUnits("0.1", 18);
  await liquidityContract.connect(sGovernor).startCampaign(rate, 0, 10000);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
