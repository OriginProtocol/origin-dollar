const { expect } = require("chai");
const bre = require("@nomiclabs/buidler");

const { defaultFixture } = require("../_fixture");
const {
  daiUnits,
  usdcUnits,
  usdtUnits,
  loadFixture,
  isGanacheFork,
} = require("../helpers");

describe.only("3Pool Contract Test", function () {
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
  // vmTracer['_stepHandler'] = async (step, next) => {
  //   console.log("🏎", step.pc, step.opcode, step.stack)
  //   next()
  // }
  vmTracer.enableTracing();
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
