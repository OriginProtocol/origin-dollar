const { createFixtureLoader } = require("../_fixture");
const { defaultArbitrumFixture } = require("../_fixture-arb");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { utils } = require("ethers");
const {
  CCIPChainSelectors,
  L2GovernanceCommands,
} = require("../../utils/constants");
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");

const arbFixture = createFixtureLoader(defaultArbitrumFixture);

describe("Mainnet Governance Executor", function () {
  let fixture;

  beforeEach(async () => {
    fixture = await arbFixture();
  });

  const getProposalData = (proposalId, commandId) => {
    return utils.defaultAbiCoder.encode(
      ["bytes2", "bytes"],
      [commandId, utils.defaultAbiCoder.encode(["uint256"], [proposalId])]
    );
  };

  describe("CCIP Message Forwarding", () => {
    it("Should allow governance to send queue proposal command", async () => {
      const { mainnetGovernor, l2Governance, executor, mockCCIPRouter } =
        fixture;

      await executor
        .connect(mainnetGovernor)
        .queueL2Proposal(CCIPChainSelectors.ArbitrumOne, 1001, 0);

      expect(await mockCCIPRouter.lastChainSelector()).to.eq(
        CCIPChainSelectors.ArbitrumOne
      );

      const msg = await mockCCIPRouter.lastMessage();
      expect(msg.receiver).to.eq(
        utils.defaultAbiCoder.encode(["address"], [l2Governance.address])
      );
      expect(msg.feeToken).to.eq(addresses.zero);
      expect(msg.extraArgs).to.eq("0x");
      expect(msg.data).to.eq(getProposalData(1001, L2GovernanceCommands.Queue));
    });

    it("Should allow governance to send cancel proposal command", async () => {
      const { mainnetGovernor, l2Governance, executor, mockCCIPRouter } =
        fixture;

      await executor
        .connect(mainnetGovernor)
        .cancelL2Proposal(CCIPChainSelectors.ArbitrumOne, 1001, 0);

      expect(await mockCCIPRouter.lastChainSelector()).to.eq(
        CCIPChainSelectors.ArbitrumOne
      );

      const msg = await mockCCIPRouter.lastMessage();
      expect(msg.receiver).to.eq(
        utils.defaultAbiCoder.encode(["address"], [l2Governance.address])
      );
      expect(msg.feeToken).to.eq(addresses.zero);
      expect(msg.extraArgs).to.eq("0x");
      expect(msg.data).to.eq(
        getProposalData(1001, L2GovernanceCommands.Cancel)
      );
    });

    it("Should allow governance to set gas limits", async () => {
      const { mainnetGovernor, l2Governance, executor, mockCCIPRouter } =
        fixture;

      await executor
        .connect(mainnetGovernor)
        .cancelL2Proposal(CCIPChainSelectors.ArbitrumOne, 1001, 400000);

      expect(await mockCCIPRouter.lastChainSelector()).to.eq(
        CCIPChainSelectors.ArbitrumOne
      );

      const msg = await mockCCIPRouter.lastMessage();
      expect(msg.receiver).to.eq(
        utils.defaultAbiCoder.encode(["address"], [l2Governance.address])
      );
      expect(msg.feeToken).to.eq(addresses.zero);
      expect(msg.data).to.eq(
        getProposalData(1001, L2GovernanceCommands.Cancel)
      );
      expect(msg.extraArgs).to.eq(
        "0x97a657c90000000000000000000000000000000000000000000000000000000000061a80"
      );
    });

    it("Should not allow anyone else to send commands", async () => {
      const { rafael, nick, governor, executor } = fixture;

      for (const signer of [rafael, nick, governor]) {
        const tx = executor
          .connect(signer)
          .cancelL2Proposal(CCIPChainSelectors.ArbitrumOne, 1001, 400000);

        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should fetch fees from CCIPRouter", async () => {
      const { mockCCIPRouter, executor, nick } = fixture;

      await mockCCIPRouter.connect(nick).setFee("10000");

      const fee = await executor.getCCIPFees(
        L2GovernanceCommands.Queue,
        CCIPChainSelectors.ArbitrumOne,
        1001,
        400000
      );

      expect(fee).to.eq("10000");
    });

    it("Should revert if destination chain is unsupported", async () => {
      const { mainnetGovernor, executor } = fixture;

      const tx = executor
        .connect(mainnetGovernor)
        .cancelL2Proposal(CCIPChainSelectors.Mainnet, 1001, 0);

      await expect(tx).to.be.revertedWith("UnsupportedChain");
    });

    it("Should revert if executor doesn't have enough balance", async () => {
      const { mainnetGovernor, executor, nick, mockCCIPRouter } = fixture;

      await mockCCIPRouter.connect(nick).setFee("10000");

      await setBalance(executor.address, "0x1");

      const tx = executor
        .connect(mainnetGovernor)
        .cancelL2Proposal(CCIPChainSelectors.ArbitrumOne, 1001, 0);

      await expect(tx).to.be.revertedWith("InsufficientBalanceForFees");
    });
  });

  describe("Chain Config", () => {
    it("Should allow governance to add chain config", async () => {
      const { mainnetGovernor, executor } = fixture;

      await executor
        .connect(mainnetGovernor)
        .addChainConfig(10023, addresses.dead);

      const [isSupported, destGovernance] = await executor.chainConfig(10023);
      expect(isSupported).to.be.true;
      expect(destGovernance).to.equal(addresses.dead);
    });

    it("Should revert on duplicate chain config", async () => {
      const { mainnetGovernor, executor } = fixture;

      const tx = executor
        .connect(mainnetGovernor)
        .addChainConfig(CCIPChainSelectors.ArbitrumOne, addresses.dead);

      await expect(tx).to.be.revertedWith("DuplicateChainConfig");
    });

    it("Should disallow null address", async () => {
      const { mainnetGovernor, executor } = fixture;

      const tx = executor
        .connect(mainnetGovernor)
        .addChainConfig(10234, addresses.zero);

      await expect(tx).to.be.revertedWith("InvalidGovernanceAddress");
    });

    it("Should disallow anyone else to add", async () => {
      const { executor, nick, rafael } = fixture;

      for (const signer of [nick, rafael]) {
        const tx = executor
          .connect(signer)
          .addChainConfig(10234, addresses.dead);

        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should allow governance to remove chain config", async () => {
      const { mainnetGovernor, executor } = fixture;

      await executor
        .connect(mainnetGovernor)
        .removeChainConfig(CCIPChainSelectors.ArbitrumOne);

      const [isSupported, destGovernance] = await executor.chainConfig(
        CCIPChainSelectors.ArbitrumOne
      );
      expect(isSupported).to.be.false;
      expect(destGovernance).to.equal(addresses.zero);
    });

    it("Should disallow removing unsupported config", async () => {
      const { mainnetGovernor, executor } = fixture;

      const tx = executor.connect(mainnetGovernor).removeChainConfig(10234);

      await expect(tx).to.be.revertedWith("UnsupportedChain");
    });

    it("Should disallow anyone else to remove", async () => {
      const { executor, nick, rafael } = fixture;

      for (const signer of [nick, rafael]) {
        const tx = executor
          .connect(signer)
          .removeChainConfig(CCIPChainSelectors.ArbitrumOne);

        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should revert initilization with invalid config", async () => {
      const { rafael } = fixture;
      const impl = await hre.ethers.getContract("MainnetGovernanceExecutor");

      const tx = impl.connect(rafael).initialize([1], []);

      await expect(tx).to.be.revertedWith("InvalidInitializationArgLength");
    });
  });
});
