const { createFixtureLoader } = require("../_fixture");
const { directStakingFixture } = require("../_fixture-base");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { oethUnits } = require("../helpers");
const ccipChainSelectors = require("../../utils/ccip-chain-selectors");
const { utils } = require("ethers");

const baseFixture = createFixtureLoader(directStakingFixture);

describe("ForkTest: Direct Staking (Base)", function () {
  this.timeout(0);

  let fixture;

  const mockRequestID =
    "0xdeadfeed00000000000000000000000000000000000000000000000000000000";

  beforeEach(async () => {
    fixture = await baseFixture();
  });

  describe("Stake requests", function () {
    it("Should allow anyone to create request", async () => {
      const { directStakingHandler, weth, nick } = fixture;

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
    });

    it("Should revert on stake if mainnet isn't configured", async () => {
      const { directStakingHandler, governor } = fixture;

      await directStakingHandler
        .connect(governor)
        .removeChainConfig(ccipChainSelectors.MAINNET_SELECTOR);

      const tx = directStakingHandler
        .connect(governor)
        .stake(oethUnits("10"), 0, false);

      await expect(tx).to.be.revertedWith("Mainnet not configured");
    });

    it("Should revert if amount is zero", async () => {
      const { directStakingHandler, governor } = fixture;

      const tx = directStakingHandler.connect(governor).stake(0, 0, false);

      await expect(tx).to.be.revertedWith("Invalid amount");
    });
  });

  describe("Messages from CCIP", function () {
    it("Should process requests", async () => {
      const {
        directStakingHandler,
        ccipRouterSigner,
        weth,
        nick,
        woeth,
        minter,
      } = fixture;

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

      await directStakingHandler.connect(ccipRouterSigner).ccipReceive({
        messageId, // Just any value to mock
        sourceChainSelector: ccipChainSelectors.MAINNET_SELECTOR, // from mainnet
        sender: utils.defaultAbiCoder.encode(
          ["address"],
          [addresses.mainnet.DirectStakingHandler]
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

    it("Should revert if received less tokens than expected", async () => {
      const { directStakingHandler, ccipRouterSigner, weth, nick } = fixture;

      // Stake
      await weth
        .connect(nick)
        .approve(directStakingHandler.address, oethUnits("1"));

      const tx = await directStakingHandler
        .connect(nick)
        .stake(oethUnits("1"), oethUnits("0.9"), false);

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

      const processTx = directStakingHandler
        .connect(ccipRouterSigner)
        .ccipReceive({
          messageId, // Just any value to mock
          sourceChainSelector: ccipChainSelectors.MAINNET_SELECTOR, // from mainnet
          sender: utils.defaultAbiCoder.encode(
            ["address"],
            [addresses.mainnet.DirectStakingHandler]
          ), // Just mock set in fixtures
          data: utils.defaultAbiCoder.encode(["bytes32"], [messageId]), // encoded message
          destTokenAmounts: [
            {
              token: addresses.base.BridgedWOETH,
              amount: oethUnits("0.8"),
            },
          ],
        });

      await expect(processTx).to.be.revertedWith("Slippage error");

      req = await directStakingHandler.stakeRequests(messageId);
      expect(req.processed).to.be.false;
    });

    it("Should accept requests from mainnet handler", async () => {
      const { directStakingHandler, ccipRouterSigner } = fixture;

      const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
        messageId: mockRequestID,
        sourceChainSelector: ccipChainSelectors.MAINNET_SELECTOR,
        sender: utils.defaultAbiCoder.encode(
          ["address"],
          [addresses.mainnet.DirectStakingHandler]
        ),
        data: utils.defaultAbiCoder.encode(["bytes32"], [mockRequestID]), // encoded message
        destTokenAmounts: [
          {
            token: addresses.base.BridgedWOETH,
            amount: oethUnits("0.9"),
          },
        ],
      });

      await expect(tx).to.not.be.revertedWith("Unknown sender");
    });

    it("Should not accept requests from other addresses on mainnet", async () => {
      const {
        directStakingHandler,
        ccipRouterSigner,
        nick,
        governor,
        strategist,
      } = fixture;

      for (const signer of [nick, governor, strategist]) {
        const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
          messageId: mockRequestID,
          sourceChainSelector: ccipChainSelectors.MAINNET_SELECTOR,
          sender: utils.defaultAbiCoder.encode(["address"], [signer.address]),
          data: utils.defaultAbiCoder.encode(["bytes32"], [mockRequestID]), // encoded message
          destTokenAmounts: [
            {
              token: addresses.base.BridgedWOETH,
              amount: oethUnits("0.9"),
            },
          ],
        });

        await expect(tx).to.be.revertedWith("Unknown sender");
      }
    });

    it("Should not accept requests from other chains", async () => {
      const { directStakingHandler, ccipRouterSigner } = fixture;

      for (const selector of [
        ccipChainSelectors.ARBITRUM_ONE_SELECTOR,
        ccipChainSelectors.BASE_SELECTOR,
      ]) {
        const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
          messageId: mockRequestID,
          sourceChainSelector: selector,
          sender: utils.defaultAbiCoder.encode(
            ["address"],
            [addresses.mainnet.DirectStakingHandler]
          ),
          data: utils.defaultAbiCoder.encode(["bytes32"], [mockRequestID]), // encoded message
          destTokenAmounts: [
            {
              token: addresses.base.BridgedWOETH,
              amount: oethUnits("0.9"),
            },
          ],
        });

        await expect(tx).to.be.revertedWith("Not from mainnet");
      }
    });

    it("Should revert on messages if mainnet isn't configured", async () => {
      const { directStakingHandler, ccipRouterSigner, governor } = fixture;

      await directStakingHandler
        .connect(governor)
        .removeChainConfig(ccipChainSelectors.MAINNET_SELECTOR);

      const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
        messageId: mockRequestID,
        sourceChainSelector: ccipChainSelectors.MAINNET_SELECTOR,
        sender: utils.defaultAbiCoder.encode(
          ["address"],
          [addresses.mainnet.DirectStakingHandler]
        ),
        data: utils.defaultAbiCoder.encode(["bytes32"], [mockRequestID]), // encoded message
        destTokenAmounts: [
          {
            token: addresses.base.BridgedWOETH,
            amount: oethUnits("0.9"),
          },
        ],
      });

      await expect(tx).to.be.revertedWith("Mainnet not configured");
    });

    it("Should revert if no tokens are sent", async () => {
      const { directStakingHandler, ccipRouterSigner } = fixture;

      const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
        messageId: mockRequestID,
        sourceChainSelector: ccipChainSelectors.MAINNET_SELECTOR,
        sender: utils.defaultAbiCoder.encode(
          ["address"],
          [addresses.mainnet.DirectStakingHandler]
        ),
        data: utils.defaultAbiCoder.encode(["bytes32"], [mockRequestID]), // encoded message
        destTokenAmounts: [],
      });

      await expect(tx).to.be.revertedWith("Invalid tokens received");
    });

    it("Should revert if wOETH is not sent", async () => {
      const { directStakingHandler, ccipRouterSigner } = fixture;

      const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
        messageId: mockRequestID,
        sourceChainSelector: ccipChainSelectors.MAINNET_SELECTOR,
        sender: utils.defaultAbiCoder.encode(
          ["address"],
          [addresses.mainnet.DirectStakingHandler]
        ),
        data: utils.defaultAbiCoder.encode(["bytes32"], [mockRequestID]), // encoded message
        destTokenAmounts: [
          {
            token: addresses.base.WETH,
            amount: oethUnits("0.9"),
          },
        ],
      });

      await expect(tx).to.be.revertedWith("Unsupported token");
    });

    it("Should revert if zero wOETH is sent", async () => {
      const { directStakingHandler, ccipRouterSigner } = fixture;

      const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
        messageId: mockRequestID,
        sourceChainSelector: ccipChainSelectors.MAINNET_SELECTOR,
        sender: utils.defaultAbiCoder.encode(
          ["address"],
          [addresses.mainnet.DirectStakingHandler]
        ),
        data: utils.defaultAbiCoder.encode(["bytes32"], [mockRequestID]), // encoded message
        destTokenAmounts: [
          {
            token: addresses.base.BridgedWOETH,
            amount: oethUnits("0"),
          },
        ],
      });

      await expect(tx).to.be.revertedWith("No tokens received");
    });

    it("Should revert if request is not found", async () => {
      const { directStakingHandler, ccipRouterSigner } = fixture;

      const tx = directStakingHandler.connect(ccipRouterSigner).ccipReceive({
        messageId: mockRequestID,
        sourceChainSelector: ccipChainSelectors.MAINNET_SELECTOR,
        sender: utils.defaultAbiCoder.encode(
          ["address"],
          [addresses.mainnet.DirectStakingHandler]
        ),
        data: utils.defaultAbiCoder.encode(["bytes32"], [mockRequestID]), // encoded message
        destTokenAmounts: [
          {
            token: addresses.base.BridgedWOETH,
            amount: oethUnits("0.9"),
          },
        ],
      });

      await expect(tx).to.be.revertedWith("Unknown request message");
    });
  });
});
