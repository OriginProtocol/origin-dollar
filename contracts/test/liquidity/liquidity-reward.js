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
    // The Reward rate should start out as:
    //      18,000,000 OGN (<- totalRewards passed in)
    //       ÷ 6,500 blocks per day
    //       ÷ 180 days in the campaign
    //       ⨉ 40% weight for the OUSD/OGN pool
    //        = 5.384615384615385 OGN per block
    liquidityRewardOUSD_USDT.connect(governor).startCampaign(utils.parseUnits("5.384615384615385", 18), 0, 6500 * 180);
    return fixture;
  }

  it('Campaign can be started and stopped appropriately', async () => {
    const {ogn, anna, governor, liquidityRewardOUSD_USDT}  
      = await loadFixture(defaultFixture);

    expect(await liquidityRewardOUSD_USDT.campaignActive()).to.equal(false);

    await expect(
        liquidityRewardOUSD_USDT.connect(anna).startCampaign(utils.parseUnits("1", 18), 0, 10)
    ).to.be.revertedWith(
      "Caller is not the Governor"
    );
    // load up the campagin with 10 ogn
    const loadAmount = utils.parseUnits("10", 18);
    ogn.connect(governor).mint(loadAmount);
    ogn.connect(governor).transfer(liquidityRewardOUSD_USDT.address, loadAmount);

    const rewardRate = utils.parseUnits("1", 18);

    await expect(
      liquidityRewardOUSD_USDT.connect(governor).startCampaign(rewardRate, 0, 11)
    ).to.be.revertedWith(
      "startCampaign: insufficient rewards"
    );

    await liquidityRewardOUSD_USDT.connect(governor).startCampaign(rewardRate, 0, 10);
    expect(await liquidityRewardOUSD_USDT.rewardPerBlock()).to.equal(rewardRate);
    expect(await liquidityRewardOUSD_USDT.campaignActive()).to.equal(true);

    await expect(
        liquidityRewardOUSD_USDT.connect(anna).stopCampaign()
    ).to.be.revertedWith(
      "Caller is not the Governor"
    );

    liquidityRewardOUSD_USDT.connect(governor).stopCampaign()
    expect(await liquidityRewardOUSD_USDT.campaignActive()).to.equal(false);


    const newRewardRate = utils.parseUnits("0.5", 18)
    await liquidityRewardOUSD_USDT.connect(governor).startCampaign(newRewardRate, 0, 20);
    expect(await liquidityRewardOUSD_USDT.rewardPerBlock()).to.equal(newRewardRate);
    expect(await liquidityRewardOUSD_USDT.campaignActive()).to.equal(true);
  });

  it('Deposit, then withdraw and claim with correct rewards after 10 blocks', async () => {
    const {ogn, anna, uniswapPairOUSD_USDT, liquidityRewardOUSD_USDT}  
      = await loadOGNLoadedLiquidityFixture();

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
      = await loadOGNLoadedLiquidityFixture();

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
