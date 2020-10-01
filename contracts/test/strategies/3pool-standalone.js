const { expect } = require("chai");

const {threepoolFixture } = require("../_fixture");
const {
  daiUnits,
  usdcUnits,
  usdtUnits,
  loadFixture,
  isGanacheFork,
} = require("../helpers");

describe("3Pool Strategy Standalone", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }
  describe("Mint", function () {
    it("should mint USDT", async function () {
      const {
        governor,
        threePool,
        threePoolToken,
        tpStandalone,
        usdt,
      } = await loadFixture(threepoolFixture);
      threePoolStrategy = tpStandalone.connect(governor);

      // Verify that we start with no pool tokens
      await expect(threePoolStrategy).has.a.balanceOf("0", threePoolToken);
      // Create 150 USDT, move it to the strategy, and deposit
      await usdt.connect(governor).mint(usdtUnits("150"));
      await usdt
        .connect(governor)
        .transfer(threePoolStrategy.address, usdtUnits("150"));

      // traceOn();
      await threePoolStrategy.deposit(usdt.address, usdtUnits("150"));
      // Verify that we now have some pool tokens
      await expect(threePoolStrategy).has.an.approxBalanceOf(
        "149.8410",
        threePoolToken
      );
    });
    it("should mint USDC", async function () {
      const {
        governor,
        threePoolToken,
        tpStandalone,
        usdc,
      } = await loadFixture(threepoolFixture);
      threePoolStrategy = tpStandalone.connect(governor);

      // Verify that we start with no pool tokens
      await expect(threePoolStrategy).has.a.balanceOf("0", threePoolToken);
      // Create 150 USDC move it to the strategy, and deposit
      await usdc.connect(governor).mint(usdcUnits("150"));
      await usdc
        .connect(governor)
        .transfer(threePoolStrategy.address, usdcUnits("150"));
      await threePoolStrategy.deposit(usdc.address, usdcUnits("150"));
      // Verify that we now have some pool tokens
      await expect(threePoolStrategy).has.an.approxBalanceOf(
        "149.9644",
        threePoolToken
      );
    });
  });
  describe("Withdraw", function () {
    it("should mint USDT and withdraw USDT", async function () {
      const {
        governor,
        threePoolToken,
        tpStandalone,
        usdt,
        
      } = await loadFixture(threepoolFixture);

      threePoolStrategy = tpStandalone.connect(governor);
      await expect(governor).has.an.approxBalanceOf(
        "1000",
        usdt
      );

      // Verify that we start with no pool tokens
      await expect(threePoolStrategy).has.a.balanceOf("0", threePoolToken);
      // Create 150 USDT, move it to the strategy, and deposit
      await usdt
        .connect(governor)
        .transfer(threePoolStrategy.address, usdtUnits("150"));
      await threePoolStrategy.deposit(usdt.address, usdtUnits("150"));
      // Verify that we now have some pool tokens
      await expect(threePoolStrategy).has.an.approxBalanceOf(
        "149.8410",
        threePoolToken
      );
      await expect(governor).has.an.approxBalanceOf(
        "850",
        usdt
      );
      

      // Withdraw
      await threePoolStrategy.withdraw(await governor.getAddress(), usdt.address, usdtUnits("100"));
      await expect(governor).has.an.approxBalanceOf(
        "950",
        usdt
      );
      await expect(threePoolStrategy).has.an.approxBalanceOf(
        "49.9088",
        threePoolToken
      );
      await threePoolStrategy.withdraw(await governor.getAddress(), usdt.address, usdtUnits("49.90"));
      await expect(governor).has.an.approxBalanceOf(
        "999.90",
        usdt
      );
    });

    
  })
  describe("Liqidate", function () {
    it("should mint USDT and Liqidate a mix", async function () {
      const {
        governor,
        threePoolToken,
        tpStandalone,
        usdc,
        usdt,
        
      } = await loadFixture(threepoolFixture);

      threePoolStrategy = tpStandalone.connect(governor);
      await expect(governor).has.an.approxBalanceOf(
        "1000",
        usdt
      );

      // Verify that we start with no pool tokens
      await expect(threePoolStrategy).has.a.balanceOf("0", threePoolToken);
      // Create 150 USDT, move it to the strategy, and deposit
      await usdt
        .connect(governor)
        .transfer(threePoolStrategy.address, usdtUnits("150"));
      await threePoolStrategy.deposit(usdt.address, usdtUnits("150"));
      // Verify that we now have some pool tokens
      await expect(threePoolStrategy).has.an.approxBalanceOf(
        "149.8410",
        threePoolToken
      );
      await expect(governor).has.an.approxBalanceOf(
        "1000",
        usdc
      );
      await expect(governor).has.an.approxBalanceOf(
        "850",
        usdt
      );
      
      await threePoolStrategy.liquidate();
      await expect(threePoolStrategy).has.an.approxBalanceOf(
        "0",
        threePoolToken
      );
      await expect(governor).has.an.approxBalanceOf(
        "1074.90",
        usdc
      );
      await expect(governor).has.an.approxBalanceOf(
        "924.97",
        usdt
      );
      
      
    });
  });
});



