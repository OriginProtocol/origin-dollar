const { expect } = require("chai");
const { BigNumber, utils } = require("ethers");

const { compoundFixture } = require("../_fixture");
const {
  advanceTime,
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  setOracleTokenPriceUsd,
  loadFixture,
  isGanacheFork,
  expectApproxSupply,
} = require("../helpers");

describe("Compound strategy", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("should return the APR for an asset", async() => {
    const { cStandalone, vault, governor, usdc, cusdc, matt } = await loadFixture(compoundFixture);
    const supplyRate = await cusdc.supplyRatePerBlock()
    // Blocks per year 6,500 blocks per day times 365 = 2372500
    const expectedApr = supplyRate.mul(2372500)
    const apr = await cStandalone.getAssetAPR(usdc.address)
    await expect(apr).to.be.equal(expectedApr)
  })

  it("should allow a withdraw", async() => {
    const { cStandalone, vault, governor, usdc, cusdc, matt } = await loadFixture(compoundFixture);
    const mattAddress = await matt.getAddress()
    const governorAddress = await governor.getAddress()
    const fakeVault = governor
    const fakeVaultAddress = governorAddress
    const stratCUSDBalance = await cusdc.balanceOf(cStandalone.address)
    
    await expect(
      await cStandalone.checkBalance(usdc.address)
    ).to.be.equal("0")

    // Fund the fake "vault" (governor)
    await expect(await usdc.balanceOf(fakeVaultAddress)).to.be.equal(usdcUnits("1000"))

    // Give the strategy some funds
    await usdc.connect(fakeVault).transfer(cStandalone.address, usdcUnits("1000"))
    await expect(await usdc.balanceOf(cStandalone.address)).to.be.equal(usdcUnits("1000"))

    // Run deposit()
    await cStandalone.connect(fakeVault).deposit(usdc.address, usdcUnits("1000"))

    const exchangeRate = await cusdc.exchangeRateStored()
    // 0xde0b6b3a7640000 == 1e18
    const expectedCusd = usdcUnits("1000").mul('0xde0b6b3a7640000').div(exchangeRate)

    // Make sure we have cUSD now
    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.above(stratCUSDBalance)
    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.equal(expectedCusd)
    await expect(await usdc.balanceOf(cStandalone.address)).to.be.equal(usdcUnits("0"))

    // event Withdrawal(address indexed _asset, address _pToken, uint256 _amount);
    await expect(
      cStandalone.connect(fakeVault).withdraw(fakeVaultAddress, usdc.address, usdcUnits("1000"))
    ).to.emit(
      cStandalone, 'Withdrawal'
    ).withArgs(usdc.address, cusdc.address, usdcUnits("1000"));

    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.equal(stratCUSDBalance)
  })

  // TODO: Compound reward token address hardcoded, unable to test?
  it.skip("should collect rewards", async() => {
    const { cStandalone, vault, governor, usdc, cusdc, matt } = await loadFixture(compoundFixture);
    const mattAddress = await matt.getAddress()
    const governorAddress = await governor.getAddress()
    const fakeVault = governor
    const fakeVaultAddress = governorAddress
    const stratCUSDBalance = await cusdc.balanceOf(cStandalone.address)
    const fakeVaultBalance = await cusdc.balanceOf(fakeVaultAddress)
    
    await expect(
      await cStandalone.checkBalance(usdc.address)
    ).to.be.equal("0")

    // Fund the fake "vault" (governor)
    await expect(await usdc.balanceOf(fakeVaultAddress)).to.be.equal(usdcUnits("1000"))

    // Give the strategy some funds
    await usdc.connect(fakeVault).transfer(cStandalone.address, usdcUnits("1000"))
    await expect(await usdc.balanceOf(cStandalone.address)).to.be.equal(usdcUnits("1000"))

    // Run deposit()
    await cStandalone.connect(fakeVault).deposit(usdc.address, usdcUnits("1000"))

    const exchangeRate = await cusdc.exchangeRateStored()
    // 0xde0b6b3a7640000 == 1e18
    const expectedCusd = usdcUnits("1000").mul('0xde0b6b3a7640000').div(exchangeRate)

    // Make sure we have cUSD now
    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.above(stratCUSDBalance)
    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.equal(expectedCusd)
    await expect(await usdc.balanceOf(cStandalone.address)).to.be.equal(usdcUnits("0"))

    // N per block cUSDC with 1 block change from our TX
    const supplyRate = await cusdc.supplyRatePerBlock()
    const expectedRewards = BigNumber.from('1000000').mul(supplyRate)

    // event Withdrawal(address indexed _asset, address _pToken, uint256 _amount);
    await expect(
      cStandalone.connect(fakeVault).collectRewardToken()
    ).to.emit(
      cStandalone, 'RewardTokenCollected'
    ).withArgs(fakeVaultAddress, expectedRewards);

    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.equal(stratCUSDBalance)
  })

  // Seems impossible to actually reach this branch because cTokens > Tokens
  it.skip("should skip withdraw if amount is lower than asset value", async () => {
    const { cStandalone, vault, governor, usdc, cusdc, matt } = await loadFixture(compoundFixture);
    const mattAddress = await matt.getAddress()
    const governorAddress = await governor.getAddress()
    const fakeVault = governor
    const fakeVaultAddress = governorAddress
    const stratCUSDBalance = await cusdc.balanceOf(cStandalone.address)
    
    await expect(
      await cStandalone.checkBalance(usdc.address)
    ).to.be.equal("0")

    // Fund the fake "vault" (governor)
    await expect(await usdc.balanceOf(fakeVaultAddress)).to.be.equal(usdcUnits("1000"))

    // Give the strategy some funds
    await usdc.connect(fakeVault).transfer(cStandalone.address, usdcUnits("1000"))
    await expect(await usdc.balanceOf(cStandalone.address)).to.be.equal(usdcUnits("1000"))

    // Run deposit()
    await cStandalone.connect(fakeVault).deposit(usdc.address, usdcUnits("1000"))

    // amount = _underlying.mul(1e18).div(exchangeRate);
    const exchangeRate = await cusdc.exchangeRateStored()
    // 0xde0b6b3a7640000 == 1e18
    const expectedCusd = usdcUnits("1000").mul('0xde0b6b3a7640000').div(exchangeRate)

    // Make sure we have cUSD now
    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.above(stratCUSDBalance)
    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.equal(expectedCusd)
    await expect(await usdc.balanceOf(cStandalone.address)).to.be.equal(usdcUnits("0"))

    await expect(
      cStandalone.connect(fakeVault).withdraw(fakeVaultAddress, usdc.address, 0)
    ).to.emit(
      cStandalone, 'SkippedWithdrawal'
    ).withArgs(usdc, 1);
  })
})
