const { createFixtureLoader } = require("../../_fixture");
const {
  defaultBaseFixture,
  directStakingFixture,
} = require("../../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../../helpers");
const { impersonateAndFund } = require("../../../utils/signers");

const baseFixture = createFixtureLoader(defaultBaseFixture);
const dsFixture = createFixtureLoader(directStakingFixture);

describe("Bridged WOETH Strategy", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  const mockRequestID =
    "0xdeadfeed00000000000000000000000000000000000000000000000000000000";

  const depositToStratTx = async (
    depositAmount = oethUnits("100"),
    price = oethUnits("1.02")
  ) => {
    const { oethbVault, woethStrategy, weth } = fixture;

    const vaultSigner = await impersonateAndFund(oethbVault.address);

    // Change oracle price
    const priceFeed = await ethers.getContract("MockPriceFeedWOETH");
    await priceFeed.setPrice(price);

    const expectedWOETH = depositAmount.mul(oethUnits("1")).div(price);
    await weth.mintTo(woethStrategy.address, depositAmount);

    const tx = await woethStrategy
      .connect(vaultSigner)
      .deposit(weth.address, depositAmount);

    return {
      tx,
      depositAmount,
      expectedWOETH,
    };
  };

  describe("Oracle price", () => {
    it("Should get price from Oracle", async () => {
      const { woethStrategy } = fixture;

      const priceFeed = await ethers.getContract("MockPriceFeedWOETH");

      // Increase price by 0.01
      await priceFeed.setPrice(oethUnits("1.02"));

      expect(await woethStrategy.getBridgedWOETHValue(oethUnits("1"))).to.equal(
        oethUnits("1.01")
      );
      await woethStrategy.updateWOETHOraclePrice();
      expect(await woethStrategy.getBridgedWOETHValue(oethUnits("1"))).to.equal(
        oethUnits("1.02")
      );
    });

    it("Should not fetch price if it's out of bounds", async () => {
      const { woethStrategy } = fixture;

      const priceFeed = await ethers.getContract("MockPriceFeedWOETH");

      // Increase price by 0.5
      await priceFeed.setPrice(oethUnits("1.5"));

      expect(await woethStrategy.getBridgedWOETHValue(oethUnits("1"))).to.equal(
        oethUnits("1.01")
      );
      await expect(woethStrategy.updateWOETHOraclePrice()).to.be.revertedWith(
        "Price diff beyond threshold"
      );
      expect(await woethStrategy.getBridgedWOETHValue(oethUnits("1"))).to.equal(
        oethUnits("1.01")
      );
    });

    it("Should not fetch price if it's lower than last one", async () => {
      const { woethStrategy } = fixture;

      const priceFeed = await ethers.getContract("MockPriceFeedWOETH");

      // Decrease price
      await priceFeed.setPrice(oethUnits("1.001"));

      expect(await woethStrategy.getBridgedWOETHValue(oethUnits("1"))).to.equal(
        oethUnits("1.01")
      );
      await expect(woethStrategy.updateWOETHOraclePrice()).to.be.revertedWith(
        "Negative wOETH yield"
      );
    });

    it("Should allow governor to set max price diff bps", async () => {
      const { woethStrategy, governor } = fixture;

      const tx = await woethStrategy.connect(governor).setMaxPriceDiffBps(5000);

      await expect(tx).to.emit(woethStrategy, "MaxPriceDiffBpsUpdated");
    });

    it("Should not allow invalid value for max price diff bps", async () => {
      const { woethStrategy, governor } = fixture;

      await expect(
        woethStrategy.connect(governor).setMaxPriceDiffBps(0)
      ).to.be.revertedWith("Invalid bps value");

      await expect(
        woethStrategy.connect(governor).setMaxPriceDiffBps(10001)
      ).to.be.revertedWith("Invalid bps value");
    });

    it("Should not allow anyone else to change it", async () => {
      const { woethStrategy, nick } = fixture;

      await expect(
        woethStrategy.connect(nick).setMaxPriceDiffBps(100)
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe("Deposit wOETH", () => {
    it("Should allow governor/strategist to deposit", async () => {
      const { governor, woethStrategy, woeth, oethb, weth } = fixture;

      const depositAmount = oethUnits("1");
      await woeth
        .connect(governor)
        .approve(woethStrategy.address, depositAmount);
      const tx = await woethStrategy
        .connect(governor)
        .depositBridgedWOETH(depositAmount);
      await expect(tx).to.emit(woethStrategy, "Deposit");

      const expectedMintedAmount = oethUnits("1.01"); // Oracle price is 1.01

      // Check state
      expect(await oethb.totalSupply()).to.equal(expectedMintedAmount);
      expect(await oethb.balanceOf(governor.address)).to.equal(
        expectedMintedAmount
      );
      expect(await woeth.balanceOf(woethStrategy.address)).to.equal(
        depositAmount
      );
      expect(await woethStrategy.checkBalance(weth.address)).to.equal(
        expectedMintedAmount
      );
    });

    it("Should always update price when depositing", async () => {
      const { governor, woethStrategy, woeth, oethb, weth } = fixture;

      // Change oracle price
      const priceFeed = await ethers.getContract("MockPriceFeedWOETH");
      await priceFeed.setPrice(oethUnits("1.02"));

      const depositAmount = oethUnits("1");
      await woeth
        .connect(governor)
        .approve(woethStrategy.address, depositAmount);
      const tx = await woethStrategy
        .connect(governor)
        .depositBridgedWOETH(depositAmount);
      await expect(tx).to.emit(woethStrategy, "Deposit");

      const expectedMintedAmount = oethUnits("1.02"); // Oracle price is 1.01

      // Check state
      expect(await oethb.totalSupply()).to.equal(expectedMintedAmount);
      expect(await oethb.balanceOf(governor.address)).to.equal(
        expectedMintedAmount
      );
      expect(await woeth.balanceOf(woethStrategy.address)).to.equal(
        depositAmount
      );
      expect(await woethStrategy.checkBalance(weth.address)).to.equal(
        expectedMintedAmount
      );
      expect(await woethStrategy.lastOraclePrice()).to.equal(oethUnits("1.02"));
    });

    it("should not allow non-governor/strategist to deposit", async () => {
      const { woethStrategy, rafael, nick } = fixture;
      const depositAmount = oethUnits("1");
      for (const user of [rafael, nick]) {
        await expect(
          woethStrategy.connect(user).depositBridgedWOETH(depositAmount)
        ).to.be.revertedWith("Caller is not the Strategist or Governor");
      }
    });
  });

  describe("Deposit WETH", async () => {
    beforeEach(async () => {
      fixture = await dsFixture();
    });

    it("Should accept WETH and create stake requests", async () => {
      const { woethStrategy, weth, mockDirectStakingHandler } = fixture;

      const { tx, depositAmount, expectedWOETH } = await depositToStratTx();

      await expect(tx).to.emit(woethStrategy, "Deposit");

      const wethBalanceAfter = await weth.balanceOf(
        mockDirectStakingHandler.address
      );
      expect(wethBalanceAfter).to.eq(depositAmount);

      const req = await woethStrategy.directStakeRequests(mockRequestID);
      expect(req.processed).to.be.false;
      expect(req.amountIn).to.eq(depositAmount);
      expect(req.minAmountOut).to.eq(expectedWOETH);
    });

    it("Should skip if deposit amount is less than threshold", async () => {
      const { woethStrategy, weth, mockDirectStakingHandler } = fixture;

      const { tx, depositAmount } = await depositToStratTx(oethUnits("0.9999"));

      await expect(tx).to.emit(woethStrategy, "Deposit");

      // Should not stake
      expect(await weth.balanceOf(mockDirectStakingHandler.address)).to.eq(0);
      expect(await woethStrategy.pendingStakedWETH()).to.eq(0);
      expect(await weth.balanceOf(woethStrategy.address)).to.eq(depositAmount);

      const req = await woethStrategy.directStakeRequests(mockRequestID);
      expect(req.processed).to.be.false;
      expect(req.amountIn).to.eq(0);
      expect(req.minAmountOut).to.eq(0);
    });

    it("Should revert if asset is unsupported", async () => {
      const { oethbVault, woethStrategy, woeth } = fixture;
      const vaultSigner = await impersonateAndFund(oethbVault.address);

      const tx = woethStrategy
        .connect(vaultSigner)
        .deposit(woeth.address, oethUnits("10"));

      await expect(tx).to.be.revertedWith("Unsupported asset");
    });

    it("Should handle callbacks from DirectStakingHandler", async () => {
      const { woethStrategy, weth, woeth, mockDirectStakingHandler } = fixture;

      const { tx, depositAmount, expectedWOETH } = await depositToStratTx();

      await expect(tx).to.emit(woethStrategy, "Deposit");

      const wethBalanceAfter = await weth.balanceOf(
        mockDirectStakingHandler.address
      );
      expect(wethBalanceAfter).to.eq(depositAmount);

      expect(await woethStrategy.pendingStakedWETH()).to.eq(depositAmount);

      let req = await woethStrategy.directStakeRequests(mockRequestID);
      expect(req.processed).to.be.false;
      expect(req.amountIn).to.eq(depositAmount);
      expect(req.minAmountOut).to.eq(expectedWOETH);

      const balanceBefore = await woeth.balanceOf(woethStrategy.address);

      await mockDirectStakingHandler.mockInvokeCallback();

      expect(await woethStrategy.pendingStakedWETH()).to.eq(0);

      const balanceAfter = await woeth.balanceOf(woethStrategy.address);
      expect(balanceAfter).to.eq(balanceBefore.add(req.minAmountOut));

      req = await woethStrategy.directStakeRequests(mockRequestID);
      expect(req.processed).to.be.true;
    });

    it("Should only accept callbacks from handler", async () => {
      const { woethStrategy, governor } = fixture;

      const tx = woethStrategy
        .connect(governor)
        .onDirectStakingRequestCompletion(mockRequestID, oethUnits("100"));
      await expect(tx).to.be.revertedWith("Not DirectStakingHandler");
    });

    it("Should not process callbacks twice for same request", async () => {
      const { woethStrategy, weth, mockDirectStakingHandler } = fixture;

      const { tx, depositAmount, expectedWOETH } = await depositToStratTx();

      await expect(tx).to.emit(woethStrategy, "Deposit");

      const wethBalanceAfter = await weth.balanceOf(
        mockDirectStakingHandler.address
      );
      expect(wethBalanceAfter).to.eq(depositAmount);

      expect(await woethStrategy.pendingStakedWETH()).to.eq(depositAmount);

      let req = await woethStrategy.directStakeRequests(mockRequestID);
      expect(req.processed).to.be.false;
      expect(req.amountIn).to.eq(depositAmount);
      expect(req.minAmountOut).to.eq(expectedWOETH);

      await mockDirectStakingHandler.mockInvokeCallback();
      req = await woethStrategy.directStakeRequests(mockRequestID);
      expect(req.processed).to.be.true;

      const secondTx = mockDirectStakingHandler.mockInvokeCallback();
      await expect(secondTx).to.be.revertedWith("Already processed");
    });

    it("Should revert if received amount is low", async () => {
      const { woethStrategy, weth, woeth, mockDirectStakingHandler } = fixture;

      const { tx, depositAmount, expectedWOETH } = await depositToStratTx();

      await expect(tx).to.emit(woethStrategy, "Deposit");

      const wethBalanceAfter = await weth.balanceOf(
        mockDirectStakingHandler.address
      );
      expect(wethBalanceAfter).to.eq(depositAmount);

      expect(await woethStrategy.pendingStakedWETH()).to.eq(depositAmount);

      let req = await woethStrategy.directStakeRequests(mockRequestID);
      expect(req.processed).to.be.false;
      expect(req.amountIn).to.eq(depositAmount);
      expect(req.minAmountOut).to.eq(expectedWOETH);

      const balanceBefore = await woeth.balanceOf(woethStrategy.address);

      await mockDirectStakingHandler.setNextMinOut(oethUnits("1"));

      const cbtx = mockDirectStakingHandler.mockInvokeCallback();
      await expect(cbtx).to.be.revertedWith("Slippage error");

      expect(await woethStrategy.pendingStakedWETH()).to.eq(depositAmount);

      const balanceAfter = await woeth.balanceOf(woethStrategy.address);
      expect(balanceAfter).to.eq(balanceBefore);

      req = await woethStrategy.directStakeRequests(mockRequestID);
      expect(req.processed).to.be.false;
    });
  });

  describe("Withdraw", () => {
    it("Should allow governor/strategist to withdraw", async () => {
      const { governor, woethStrategy, woeth, oethb, weth } = fixture;

      const depositAmount = oethUnits("1");
      await woeth
        .connect(governor)
        .approve(woethStrategy.address, depositAmount);
      await woethStrategy.connect(governor).depositBridgedWOETH(depositAmount);

      const mintedOETHbAmount = oethUnits("1.01");

      await oethb
        .connect(governor)
        .approve(woethStrategy.address, mintedOETHbAmount);
      const tx = await woethStrategy
        .connect(governor)
        .withdrawBridgedWOETH(mintedOETHbAmount);
      await expect(tx).to.emit(woethStrategy, "Withdrawal");

      // Check state
      expect(await oethb.totalSupply()).to.equal(0);
      expect(await oethb.balanceOf(governor.address)).to.equal(0);
      expect(await woeth.balanceOf(woethStrategy.address)).to.equal(0);
      expect(await woeth.balanceOf(governor.address)).to.equal(oethUnits("1"));
      expect(await woethStrategy.checkBalance(weth.address)).to.equal(0);
    });

    it("should not allow non-governor/strategist to deposit", async () => {
      const { woethStrategy, rafael, nick } = fixture;
      const withdrawAmount = oethUnits("1");

      for (const user of [rafael, nick]) {
        await expect(
          woethStrategy.connect(user).withdrawBridgedWOETH(withdrawAmount)
        ).to.be.revertedWith("Caller is not the Strategist or Governor");
      }
    });
  });

  describe("Asset & Balance", () => {
    it("checkBalance should always use lastOraclePrice", async () => {
      const { governor, woethStrategy, woeth, weth } = fixture;

      // Transfer some wOETH to strategy
      await woeth
        .connect(governor)
        .transfer(woethStrategy.address, oethUnits("1"));

      // Change oracle price
      const priceFeed = await ethers.getContract("MockPriceFeedWOETH");
      await priceFeed.setPrice(oethUnits("1.02"));

      // Should use last price
      expect(await woethStrategy.checkBalance(weth.address)).to.equal(
        oethUnits("1.01")
      );
      expect(await woethStrategy.getBridgedWOETHValue(oethUnits("1"))).to.equal(
        oethUnits("1.01")
      );

      // Update price
      await woethStrategy.updateWOETHOraclePrice();

      // Should use latest price
      expect(await woethStrategy.checkBalance(weth.address)).to.equal(
        oethUnits("1.02")
      );
      expect(await woethStrategy.getBridgedWOETHValue(oethUnits("1"))).to.equal(
        oethUnits("1.02")
      );
    });

    it("checkBalance should revert for unsupported assets", async () => {
      const { woethStrategy, weth, woeth } = fixture;
      await expect(
        woethStrategy.checkBalance(woeth.address)
      ).to.be.revertedWith("Unsupported asset");
      await expect(woethStrategy.checkBalance(weth.address)).to.not.be.reverted;
    });

    it("should only show WETH as supported asset", async () => {
      const { woethStrategy, weth, woeth } = fixture;
      expect(await woethStrategy.supportsAsset(woeth.address)).to.be.false;
      expect(await woethStrategy.supportsAsset(weth.address)).to.be.true;
    });

    it("Should include WETH dust in balance", async () => {
      const { governor, woethStrategy, woeth, weth } = fixture;

      // Transfer some wOETH to strategy
      await woeth
        .connect(governor)
        .transfer(woethStrategy.address, oethUnits("1"));

      // Change oracle price
      const priceFeed = await ethers.getContract("MockPriceFeedWOETH");
      await priceFeed.setPrice(oethUnits("1.02"));

      // Update price
      await woethStrategy.updateWOETHOraclePrice();

      // Take snapshot
      const balanceBefore = await woethStrategy.checkBalance(weth.address);

      // Donate some WETH
      await weth.mintTo(woethStrategy.address, oethUnits("9876"));

      // Ensure it works as expected
      const balanceAfter = await woethStrategy.checkBalance(weth.address);
      expect(balanceAfter).to.eq(balanceBefore.add(oethUnits("9876")));
    });

    it("Should include pending direct stake amounts", async () => {
      const { woethStrategy, weth } = fixture;

      // Take snapshot
      const balanceBefore = await woethStrategy.checkBalance(weth.address);

      // Do some stake
      const { depositAmount } = await depositToStratTx(oethUnits("123.56"));

      // Ensure it works as expected
      const balanceAfter = await woethStrategy.checkBalance(weth.address);
      expect(await woethStrategy.pendingStakedWETH()).to.eq(depositAmount);
      expect(balanceAfter).to.eq(balanceBefore.add(depositAmount));
    });
  });
});
