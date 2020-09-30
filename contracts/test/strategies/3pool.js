const { expect } = require("chai");
const bre = require("@nomiclabs/buidler");

const { defaultFixture, threepoolFixture } = require("../_fixture");
const {
  daiUnits,
  usdcUnits,
  usdtUnits,
  loadFixture,
  isGanacheFork,
} = require("../helpers");

describe("3Pool Strategy", function () {
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

      console.log("tps", threePoolStrategy.address);
      console.log("tp", threePool.address);
      console.log("tpt", threePoolToken.address);
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
        threePool,
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
  describe.only("Withdraw", function () {
    it("should mint USDT and withdraw USDT", async function () {
      const {
        governor,
        threePool,
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
});

describe("3Pool Contract Test", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  describe("Mint and redeem", function () {
    let usdt, usdc, dai, anna, threePool, threePoolToken;

    before(async () => {
      const fixture = await loadFixture(defaultFixture);
      usdt = fixture.usdt;
      usdc = fixture.usdc;
      dai = fixture.dai;
      anna = fixture.anna;
      threePool = fixture.threePool;
      threePoolToken = fixture.threePoolToken;
    });

    it("should start with expected balances", async () => {
      await expect(anna).has.a.balanceOf("0", threePoolToken);
      await expect(anna).has.a.balanceOf("1000", dai);
      await expect(anna).has.a.balanceOf("1000", usdc);
      await expect(anna).has.a.balanceOf("1000", usdt);
    });

    it("can add_liquidity", async () => {
      // Approve tokens
      await dai.connect(anna).approve(threePool.address, daiUnits("50"));
      await usdc.connect(anna).approve(threePool.address, usdcUnits("100"));
      await usdt.connect(anna).approve(threePool.address, usdtUnits("150"));

      // add_liquidity
      await threePool
        .connect(anna)
        .add_liquidity(
          [daiUnits("50"), usdcUnits("100"), usdtUnits("150")],
          daiUnits("0")
        );
    });

    it("should have expected balances after add_liquidity", async () => {
      await expect(anna).has.an.approxBalanceOf("299.90", threePoolToken);
      await expect(anna).has.an.approxBalanceOf("950", dai);
      await expect(anna).has.an.approxBalanceOf("900", usdc);
      await expect(anna).has.an.approxBalanceOf("850", usdt);
    });

    it("can withdraw all", async () => {
      const balance = await threePoolToken.balanceOf(await anna.getAddress());
      await threePool
        .connect(anna)
        .remove_liquidity_one_coin(balance, 2, usdtUnits("0"));
    });

    it("should have expected balances after remove_liquidity_one_coin", async () => {
      await expect(anna).has.an.approxBalanceOf("0", threePoolToken);
      await expect(anna).has.an.approxBalanceOf("950", dai);
      await expect(anna).has.an.approxBalanceOf("900", usdc);
      await expect(anna).has.an.approxBalanceOf("1150.105060", usdt);
    });
  });
});

function traceOn() {
  const node = bre.network.provider["_node"];
  const vmTracer = node["_vmTracer"];
  vmTracer.disableTracing();
  vmTracer["_beforeMessageHandler"] = async (message, next) => {
    const sig = bufferToHex(message.data.slice(0, 4));
    if (sig == "00000000") {
      console.log("EVENT?: ", bufferToHex(message.data.slice(4)));
    } else {
      console.log(
        "📲 ",
        sig,
        bufferToHex(message.data.slice(4)),
        "→",
        bufferToHex(message.to)
      );
    }
    next();
  };
  // vmTracer['_afterMessageHandler'] = async (message, next) => {
  //   console.log("🏓", message)
  //   next()
  // }
  const getStack = (step, i) => {
    if (step.stack.length <= i) {
      return "-";
    }
    return step.stack[step.stack.length - i - 1].toString(16);
  };
  // vmTracer["_stepHandler"] = async (step, next) => {
  //   console.log("🏎", step.pc, step.opcode, getStack(step,0), getStack(step, 1), step.stack.length);
  //   next();
  // };
  vmTracer.enableTracing();
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
