const { createFixtureLoader } = require("../_fixture");
const { directStakingFixture } = require("../_fixture-base");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { oethUnits } = require("../helpers");
const ccipChainSelectors = require("../../utils/ccip-chain-selectors");
const { impersonateAndFund } = require("../../utils/signers");
const { utils } = require("ethers");
// const { replaceContractAt } = require("../../utils/hardhat");

const baseFixture = createFixtureLoader(directStakingFixture);

describe("ForkTest: Direct Staking (Base)", function () {
  let fixture;

  const mockRequestID =
    "0xdeadfeed00000000000000000000000000000000000000000000000000000000";

  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it("Should allow anyone to create request", async () => {
    const { directStakingHandler, weth, nick, woeth, minter } = fixture;

    // Mock router
    // await replaceContractAt(addresses.base.ccipRouter, mockRouter)
    // const ccipRouter = await ethers.getContractAt("MockCCIPRouter", addresses.base.ccipRouter)
    // await ccipRouter.setFee(oethUnits("0.001"));

    // Stake
    await weth
      .connect(nick)
      .approve(directStakingHandler.address, oethUnits("1"));

    const tx = await directStakingHandler
      .connect(nick)
      .stake(oethUnits("1"), 0, false);

    const { events } = await tx.wait();
    const stakeEvent = events.find(
      (e) => e.event == "DirectStakeRequestCreated"
    );

    expect(stakeEvent).to.not.be.undefined;
    expect(stakeEvent.args.destChain).to.eq(
      ccipChainSelectors.MAINNET_SELECTOR
    );

    const messageId = stakeEvent.args.messageId;
    let req = await directStakingHandler.stakeRequests(messageId);
    expect(req.processed).to.be.false;

    // Mock token transfer
    await woeth
      .connect(minter)
      .mint(directStakingHandler.address, oethUnits("0.9"));

    // // Mock request resolving
    // await ccipRouter.mockSend(
    //     directStakingHandler.address,
    //     ccipChainSelectors.MAINNET_SELECTOR,
    //     addresses.base.strategist,
    //     utils.defaultAbiCoder.encode(["bytes32"], [messageId]), // encoded message
    //     [{
    //         token: addresses.base.BridgedWOETH,
    //         amount: oethUnits("0.9")
    //     }]
    // )

    const ccipRouter = await impersonateAndFund(addresses.base.ccipRouter);
    await directStakingHandler.connect(ccipRouter).ccipReceive({
      messageId, // Just any value to mock
      sourceChainSelector: ccipChainSelectors.MAINNET_SELECTOR, // from mainnet
      sender: utils.defaultAbiCoder.encode(
        ["address"],
        [addresses.base.strategist]
      ), // Just mock set in fixtures
      data: utils.defaultAbiCoder.encode(["bytes32"], [messageId]), // encoded message
      destTokenAmounts: [
        {
          token: addresses.base.BridgedWOETH,
          amount: oethUnits("0.9"),
        },
      ],
    });

    req = await directStakingHandler.stakeRequests(messageId);
    expect(req.processed).to.eq(true);
    expect(req.amountReceived).to.eq(oethUnits("0.9"));
  });

  it("Should only accept requests from mainnet handler", async () => {
    const { directStakingHandler, ccipRouterSigner } = fixture;

    await directStakingHandler.connect(ccipRouterSigner).ccipReceive({
      messageId: mockRequestID,
      sourceChainSelector: ccipChainSelectors.MAINNET_SELECTOR,
      sender: utils.defaultAbiCoder.encode(
        ["address"],
        // TODO: Change values after deploying proxies
        [addresses.base.strategist]
      ), // Just mock set in fixtures
      data: utils.defaultAbiCoder.encode(["bytes32"], [mockRequestID]), // encoded message
      destTokenAmounts: [
        {
          token: addresses.base.BridgedWOETH,
          amount: oethUnits("0.9"),
        },
      ],
    });
  });
});
