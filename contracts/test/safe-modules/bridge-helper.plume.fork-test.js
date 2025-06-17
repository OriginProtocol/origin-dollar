const { createFixtureLoader } = require("../_fixture");
const { bridgeHelperModuleFixture } = require("../_fixture-plume");
const { oethUnits } = require("../helpers");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");

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

    const balanceBefore = await woeth.balanceOf(safeSigner.address);

    // Bridge 1 wOETH to Ethereum
    const tx = await bridgeHelperModule
      .connect(safeSigner)
      .bridgeWOETHToEthereum(
        oethUnits("1"),
        50 // 0.5% slippage
      );

    // Check balance
    const balanceAfter = await woeth.balanceOf(safeSigner.address);
    expect(balanceAfter).to.eq(balanceBefore.sub(oethUnits("1")));

    // Check events
    const { events } = await tx.wait();

    const lzBridgeEvent = events.find(
      (e) =>
        e.address.toLowerCase() ===
        addresses.plume.WOETHOmnichainAdapter.toLowerCase()
    );

    expect(lzBridgeEvent.topics[2]).to.eq(
      "0x0000000000000000000000004ff1b9d9ba8558f5eafcec096318ea0d8b541971"
    );
    const [endpointId, amountSentLD, minAmountLD] =
      ethers.utils.defaultAbiCoder.decode(
        ["uint256", "uint256", "uint256"],
        lzBridgeEvent.data
      );
    expect(endpointId).to.eq("30101");
    expect(amountSentLD).to.eq(oethUnits("1"));
    expect(minAmountLD).to.eq(oethUnits("1"));
  });

  it("Should bridge WETH to Ethereum", async () => {
    const { mintableWETHContract, governor, safeSigner, bridgeHelperModule } =
      fixture;

    // Mint 1 WETH
    await mintableWETHContract
      .connect(governor)
      .mint(safeSigner.address, oethUnits("1"));

    // Bridge 1 WETH to Ethereum
    const tx = await bridgeHelperModule
      .connect(safeSigner)
      .bridgeWETHToEthereum(
        oethUnits("1"),
        100 // 1% slippage
      );

    const { events } = await tx.wait();

    const lzBridgeEvent = events.find(
      (e) =>
        e.address.toLowerCase() ===
        addresses.plume.WETHOmnichainAdapter.toLowerCase()
    );

    expect(lzBridgeEvent.topics[2]).to.eq(
      "0x0000000000000000000000004ff1b9d9ba8558f5eafcec096318ea0d8b541971"
    );
    const [endpointId, amountSentLD, minAmountLD] =
      ethers.utils.defaultAbiCoder.decode(
        ["uint256", "uint256", "uint256"],
        lzBridgeEvent.data
      );
    expect(endpointId).to.eq("30101");
    expect(amountSentLD).to.eq(oethUnits("1"));
    expect(minAmountLD).to.eq(oethUnits("1"));
  });

  it("Should deposit wOETH for OETHp and redeem it for WETH", async () => {});

  it("Should mint OETHp with WETH and redeem it for wOETH", async () => {});
});
