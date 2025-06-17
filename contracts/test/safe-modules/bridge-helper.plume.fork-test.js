const { createFixtureLoader } = require("../_fixture");
const { bridgeHelperModuleFixture } = require("../_fixture-plume");
const { oethUnits } = require("../helpers");

const plumeFixture = createFixtureLoader(bridgeHelperModuleFixture);

describe("ForkTest: Bridge Helper Safe Module", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await plumeFixture();
  });

  it("Should bridge wOETH to Ethereum", async () => {
    const { woeth, governor, safeSigner, bridgeHelperModule } = fixture;

    // Mint 1 wOETH
    await woeth.connect(governor).mint(safeSigner.address, oethUnits("1"));

    // Bridge 1 wOETH to Ethereum
    await bridgeHelperModule.connect(safeSigner).bridgeWOETHToEthereum(
      oethUnits("1"),
      50 // 0.5% slippage
    );
  });

  it("Should bridge WETH to Ethereum", async () => {});

  it("Should deposit wOETH for OETHp and redeem it for WETH", async () => {});

  it("Should mint OETHp with WETH and redeem it for wOETH", async () => {});
});
