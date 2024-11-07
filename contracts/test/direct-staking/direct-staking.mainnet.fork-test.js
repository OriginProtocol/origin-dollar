const { createFixtureLoader, directStakingFixture } = require("../_fixture");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { oethUnits } = require("../helpers");
const ccipChainSelectors = require("../../utils/ccip-chain-selectors");
const { utils } = require("ethers");

const runFixtures = createFixtureLoader(directStakingFixture);

describe("ForkTest: Direct Staking (Mainnet)", function () {
  this.timeout(0);

  let fixture;

  const mockRequestID =
    "0xdeadfeed00000000000000000000000000000000000000000000000000000000";

  beforeEach(async () => {
    fixture = await runFixtures();
  });

  it("Should handle incoming requests", async () => {
    const {
      directStakingHandler,
      weth,
      woeth,
      domen,
      oethDripper,
      ccipRouterSigner,
      oeth,
    } = fixture;

    // Mock token transfer
    await weth
      .connect(domen)
      .transfer(directStakingHandler.address, oethUnits("1"));

    await oethDripper.collectAndRebase();
    const expectedWOETH = await woeth.previewDeposit(oethUnits("1"));

    const supBefore = await oeth.totalSupply();
    const woethSupBefore = await woeth.totalSupply();

    await directStakingHandler.connect(ccipRouterSigner).ccipReceive({
      messageId: mockRequestID,
      sourceChainSelector: ccipChainSelectors.BASE_SELECTOR,
      sender: utils.defaultAbiCoder.encode(
        ["address"],
        [addresses.base.DirectStakingHandler]
      ),
      data: utils.defaultAbiCoder.encode(["uint256"], [oethUnits("0.8")]), // minReceived
      destTokenAmounts: [
        {
          token: addresses.mainnet.WETH,
          amount: oethUnits("1"),
        },
      ],
    });

    const supAfter = await oeth.totalSupply();
    const woethSupAfter = await woeth.totalSupply();

    expect(supAfter.sub(supBefore)).to.approxEqualTolerance(oethUnits("1"));
    expect(woethSupAfter.sub(woethSupBefore)).to.approxEqualTolerance(
      expectedWOETH
    );
  });

  it("Should revert if chain is unsupported", async () => {
    const { directStakingHandler, ccipRouterSigner, timelock } = fixture;

    await directStakingHandler
      .connect(timelock)
      .removeChainConfig(ccipChainSelectors.BASE_SELECTOR);

    const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
      messageId: mockRequestID,
      sourceChainSelector: ccipChainSelectors.BASE_SELECTOR,
      sender: utils.defaultAbiCoder.encode(
        ["address"],
        [addresses.base.DirectStakingHandler]
      ),
      data: utils.defaultAbiCoder.encode(["uint256"], [oethUnits("10")]), // encoded message
      destTokenAmounts: [
        {
          token: addresses.mainnet.WETH,
          amount: oethUnits("1"),
        },
      ],
    });

    await expect(tx).to.be.revertedWith("Unsupported source chain");
  });

  it("Should only accept requests from known handlers", async () => {
    const { directStakingHandler, ccipRouterSigner } = fixture;

    const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
      messageId: mockRequestID,
      sourceChainSelector: ccipChainSelectors.BASE_SELECTOR,
      sender: utils.defaultAbiCoder.encode(
        ["address"],
        [addresses.base.strategist]
      ),
      data: utils.defaultAbiCoder.encode(["uint256"], [oethUnits("10")]), // encoded message
      destTokenAmounts: [
        {
          token: addresses.mainnet.WETH,
          amount: oethUnits("1"),
        },
      ],
    });

    await expect(tx).to.be.revertedWith("Unknown sender");
  });

  it("Should revert on invalid token count", async () => {
    const { directStakingHandler, ccipRouterSigner } = fixture;

    const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
      messageId: mockRequestID,
      sourceChainSelector: ccipChainSelectors.BASE_SELECTOR,
      sender: utils.defaultAbiCoder.encode(
        ["address"],
        [addresses.base.DirectStakingHandler]
      ),
      data: utils.defaultAbiCoder.encode(["uint256"], [oethUnits("10")]), // encoded message
      destTokenAmounts: [],
    });

    await expect(tx).to.be.revertedWith("Invalid tokens sent");
  });

  it("Should revert if received token is not WETH", async () => {
    const { directStakingHandler, ccipRouterSigner } = fixture;

    const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
      messageId: mockRequestID,
      sourceChainSelector: ccipChainSelectors.BASE_SELECTOR,
      sender: utils.defaultAbiCoder.encode(
        ["address"],
        [addresses.base.DirectStakingHandler]
      ),
      data: utils.defaultAbiCoder.encode(["uint256"], [oethUnits("10")]), // encoded message
      destTokenAmounts: [
        {
          token: addresses.mainnet.WOETHProxy,
          amount: oethUnits("1"),
        },
      ],
    });

    await expect(tx).to.be.revertedWith("Unsupported source token");
  });

  it("Should revert if no WETH sent", async () => {
    const { directStakingHandler, ccipRouterSigner } = fixture;

    const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
      messageId: mockRequestID,
      sourceChainSelector: ccipChainSelectors.BASE_SELECTOR,
      sender: utils.defaultAbiCoder.encode(
        ["address"],
        [addresses.base.DirectStakingHandler]
      ),
      data: utils.defaultAbiCoder.encode(["uint256"], [oethUnits("10")]), // encoded message
      destTokenAmounts: [
        {
          token: addresses.mainnet.WETH,
          amount: 0,
        },
      ],
    });

    await expect(tx).to.be.revertedWith("No tokens sent");
  });

  it("Should revert on high slippage", async () => {
    const { directStakingHandler, weth, domen, oethDripper, ccipRouterSigner } =
      fixture;

    // Mock token transfer
    await weth
      .connect(domen)
      .transfer(directStakingHandler.address, oethUnits("1"));

    await oethDripper.collectAndRebase();

    const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
      messageId: mockRequestID,
      sourceChainSelector: ccipChainSelectors.BASE_SELECTOR,
      sender: utils.defaultAbiCoder.encode(
        ["address"],
        [addresses.base.DirectStakingHandler]
      ),
      data: utils.defaultAbiCoder.encode(["uint256"], [oethUnits("1.2")]), // minReceived
      destTokenAmounts: [
        {
          token: addresses.mainnet.WETH,
          amount: oethUnits("1"),
        },
      ],
    });

    await expect(tx).to.be.revertedWith("Slippage issue");
  });
});
