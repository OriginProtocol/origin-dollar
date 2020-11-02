const { ethers } = require("@nomiclabs/buidler");
const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { utils } = require("ethers");
const {
  advanceBlocks,
  daiUnits,
  usdtUnits,
  ousdUnits,
  units,
  loadFixture,
  expectApproxSupply,
  isGanacheFork,
} = require("../helpers");


describe('Liquidity Reward', function ()  {
  if (isGanacheFork) {
    this.timeout(0);
  }

  const loadOGNLoadedLiquidityFixture = async () => {
    const fixture = await loadFixture(defaultFixture);
    const {ogn, governor, liquidityRewardOUSD_USDT} = fixture;

    // fill out the ogn
    const loadAmount = utils.parseUnits("18000000", 18);
    ogn.connect(governor).mint(loadAmount);
    ogn.connect(governor).transfer(liquidityRewardOUSD_USDT.address, loadAmount);
    return fixture;
  }

  it('should governor can set Reward per block', async () => {
    const {anna, governor, liquidityRewardOUSD_USDT}  
      = await loadFixture(defaultFixture);
    await expect(
        liquidityRewardOUSD_USDT.connect(anna).setRewardPerBlock(utils.parseUnits("1", 18))
      ).to.be.revertedWith(
      "Caller is not the Governor"
    );

    await (liquidityRewardOUSD_USDT.connect(governor).setRewardPerBlock(utils.parseUnits("1", 18)));
    expect(await liquidityRewardOUSD_USDT.rewardPerBlock()).to.equal(utils.parseUnits("1", 18));
  });

  it('Deposit and withdraw with correct rewards after 10 blocks', async () => {
    const {ogn, anna, uniswapPairOUSD_USDT, liquidityRewardOUSD_USDT}  
      = await loadOGNLoadedLiquidityFixture();

    // mint and deposit the LP token into liquidity reward contract
    const depositAmount = utils.parseUnits("1", 18);
    await uniswapPairOUSD_USDT.connect(anna).mint(depositAmount);
    await uniswapPairOUSD_USDT.connect(anna).approve(liquidityRewardOUSD_USDT.address, depositAmount);
    await liquidityRewardOUSD_USDT.connect(anna).deposit(depositAmount);

    expect(await uniswapPairOUSD_USDT.balanceOf(liquidityRewardOUSD_USDT.address)).to.equal(depositAmount);

    const rewardPerBlock = await liquidityRewardOUSD_USDT.rewardPerBlock();
    console.log("rewardPerBlock:", rewardPerBlock.toString());

    expect(await liquidityRewardOUSD_USDT.totalOutstandingRewards()).to.equal('0');
    expect(await liquidityRewardOUSD_USDT.pendingRewards(anna._address)).to.equal('0');

    //advance 10 blocks
    await advanceBlocks(10);

    // we should get all the rewards for 10 blocks since we're the only ones here
    const rewardAmount = rewardPerBlock.mul(10);

    expect(await liquidityRewardOUSD_USDT.totalOutstandingRewards()).to.equal(rewardAmount);
    expect(await liquidityRewardOUSD_USDT.pendingRewards(anna._address)).to.equal(rewardAmount);

    // +1 block for the withdraw itself
    const withdrawRewardAmount = rewardPerBlock.mul(11);
    await liquidityRewardOUSD_USDT.connect(anna).withdraw(depositAmount);

    expect(await ogn.balanceOf(anna._address)).to.equal(withdrawRewardAmount);
    expect(await liquidityRewardOUSD_USDT.totalOutstandingRewards()).to.equal('0');

  });
});
