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

  it('Campaign can be stopped and started appropriately', async () => {
    const {ogn, anna, governor, liquidityRewardOUSD_USDT}  
      = await loadFixture(defaultFixture);

    expect(await liquidityRewardOUSD_USDT.campaignActive()).to.equal(true);

    await expect(
        liquidityRewardOUSD_USDT.connect(anna).stopCampaign()
    ).to.be.revertedWith(
      "Caller is not the Governor"
    );

    liquidityRewardOUSD_USDT.connect(governor).stopCampaign()
    expect(await liquidityRewardOUSD_USDT.campaignActive()).to.equal(false);

    const newRewardRate = (await liquidityRewardOUSD_USDT.rewardPerBlock()).mul(2);
    const newNumBlocks = (6500 * 180) / 2; //6500 * 180 is the estimated number of blocks set for the initial strategy

    await expect(
        liquidityRewardOUSD_USDT.connect(anna).startCampaign(newRewardRate, 0, newNumBlocks)
    ).to.be.revertedWith(
      "Caller is not the Governor"
    );

    await expect(
      liquidityRewardOUSD_USDT.connect(governor).startCampaign(newRewardRate, 0, newNumBlocks+1)
    ).to.be.revertedWith(
      "startCampaign: insufficient rewards"
    );

    await liquidityRewardOUSD_USDT.connect(governor).startCampaign(newRewardRate, 0, newNumBlocks);
    expect(await liquidityRewardOUSD_USDT.rewardPerBlock()).to.equal(newRewardRate);
    expect(await liquidityRewardOUSD_USDT.campaignActive()).to.equal(true);
    
  });

  it('Deposit, then withdraw and claim with correct rewards after 10 blocks', async () => {
    const {ogn, anna, uniswapPairOUSD_USDT, liquidityRewardOUSD_USDT}  
      = await loadFixture(defaultFixture);

    // mint and deposit the LP token into liquidity reward contract
    const depositAmount = utils.parseUnits("1", 18);
    await uniswapPairOUSD_USDT.connect(anna).mint(depositAmount);
    await uniswapPairOUSD_USDT.connect(anna).approve(liquidityRewardOUSD_USDT.address, depositAmount);
    await liquidityRewardOUSD_USDT.connect(anna).deposit(depositAmount);

    expect(await uniswapPairOUSD_USDT.balanceOf(liquidityRewardOUSD_USDT.address)).to.equal(depositAmount);

    const rewardPerBlock = await liquidityRewardOUSD_USDT.rewardPerBlock();

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
    await liquidityRewardOUSD_USDT.connect(anna).withdraw(depositAmount, true);

    expect(await ogn.balanceOf(anna._address)).to.equal(withdrawRewardAmount);
    expect(await uniswapPairOUSD_USDT.balanceOf(anna._address)).to.equal(depositAmount);
    expect(await liquidityRewardOUSD_USDT.totalOutstandingRewards()).to.equal('0');

  });

  it('Deposit, withdraw, and claim separately with correct rewards after 10 blocks', async () => {
    const {ogn, anna, uniswapPairOUSD_USDT, liquidityRewardOUSD_USDT}  
      = await loadFixture(defaultFixture);

    // mint and deposit the LP token into liquidity reward contract
    const depositAmount = utils.parseUnits("1", 18);
    await uniswapPairOUSD_USDT.connect(anna).mint(depositAmount);
    await uniswapPairOUSD_USDT.connect(anna).approve(liquidityRewardOUSD_USDT.address, depositAmount);
    await liquidityRewardOUSD_USDT.connect(anna).deposit(depositAmount);

    const rewardPerBlock = await liquidityRewardOUSD_USDT.rewardPerBlock();

    //advance 10 blocks
    await advanceBlocks(10);

    await liquidityRewardOUSD_USDT.connect(anna).withdraw(depositAmount, false);
    // no rewards on false
    expect(await ogn.balanceOf(anna._address)).to.equal('0');
    // but the withdraw should be good
    expect(await uniswapPairOUSD_USDT.balanceOf(anna._address)).to.equal(depositAmount);

    // +1 block for the withdraw 
    // after the withdraw there's zero LPTokens so there will be no more reward accrued for the extra block
    const withdrawRewardAmount = rewardPerBlock.mul(11);

    await liquidityRewardOUSD_USDT.connect(anna).claim();
    expect(await ogn.balanceOf(anna._address)).to.equal(withdrawRewardAmount);
    expect(await liquidityRewardOUSD_USDT.totalOutstandingRewards()).to.equal('0');
  });

});
