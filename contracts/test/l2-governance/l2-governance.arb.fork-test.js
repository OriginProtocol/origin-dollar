const { createFixtureLoader } = require("../_fixture");
const { defaultArbitrumFixture, MINTER_ROLE } = require("../_fixture-arb");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { utils } = require("ethers");
const { advanceBlocks } = require("../helpers");
const {
  CCIPChainSelectors,
  L2GovernanceCommands,
} = require("../../utils/constants");

const arbFixture = createFixtureLoader(defaultArbitrumFixture);

describe("L2 Governance", function () {
  let fixture;

  this.timeout(0);

  beforeEach(async () => {
    fixture = await arbFixture();
  });

  async function makeProposal() {
    const { l2Governance, rafael, nick, woeth } = fixture;

    // Make a proposal (simulating grantRole on wOETH)
    const tx = await l2Governance
      .connect(rafael)
      .propose(
        [woeth.address],
        [0],
        ["grantRole(bytes32,address)"],
        [
          utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [MINTER_ROLE, nick.address]
          ),
        ],
        ""
      );

    const receipt = await tx.wait();
    const ev = receipt.events.find((e) => e.event == "ProposalCreated");
    return ev.args[0];
  }

  describe("Proposals", function () {
    it("Should allow anyone to propose", async () => {
      const { l2Governance, woeth } = fixture;

      const proposalId = await makeProposal();

      // Check and verify proposal
      expect(await l2Governance.state(proposalId)).to.equal(0); // Pending

      const [targets, values, signatures, calldata] =
        await l2Governance.getActions(proposalId);
      expect(targets.length).to.equal(1);
      expect(targets[0]).to.equal(woeth.address);
      expect(values.length).to.equal(1);
      expect(values[0]).to.eq(0);
      expect(signatures.length).to.equal(1);
      expect(signatures[0]).to.equal("grantRole(bytes32,address)");
      expect(calldata.length).to.equal(1);
    });

    it("Should allow Mainnet Governance to queue through CCIP Router", async () => {
      const { l2Governance, ccipRouterSigner, executor, l2Governor } = fixture;

      const proposalId = await makeProposal();

      // Check and verify proposal state
      expect(await l2Governance.state(proposalId)).to.equal(0); // Pending

      const tx = await l2Governance.connect(ccipRouterSigner).ccipReceive({
        messageId:
          "0xdeadfeed00000000000000000000000000000000000000000000000000000000",
        sourceChainSelector: CCIPChainSelectors.Mainnet,
        sender: utils.defaultAbiCoder.encode(["address"], [executor.address]),
        data: utils.defaultAbiCoder.encode(
          ["bytes2", "bytes"],
          [
            L2GovernanceCommands.Queue,
            utils.defaultAbiCoder.encode(["uint256"], [proposalId]),
          ]
        ),
        destTokenAmounts: [],
      });

      const [scheduledEv] = (await tx.wait()).events;

      // Check and verify proposal state
      expect(await l2Governance.getTimelockHash(proposalId)).to.eq(
        scheduledEv.topics[1]
      );
      expect(await l2Governance.state(proposalId)).to.equal(1); // Queued
      expect(await l2Governor.isOperation(scheduledEv.topics[1])).to.be.true; // Scheduled
    });

    it("Should allow anyone to executed after timelock", async () => {
      const {
        l2Governance,
        l2Governor,
        ccipRouterSigner,
        executor,
        nick,
        woeth,
      } = fixture;

      const proposalId = await makeProposal();

      // Check and verify proposal state
      expect(await l2Governance.state(proposalId)).to.equal(0); // Pending

      const tx = await l2Governance.connect(ccipRouterSigner).ccipReceive({
        messageId:
          "0xdeadfeed00000000000000000000000000000000000000000000000000000000",
        sourceChainSelector: CCIPChainSelectors.Mainnet,
        sender: utils.defaultAbiCoder.encode(["address"], [executor.address]),
        data: utils.defaultAbiCoder.encode(
          ["bytes2", "bytes"],
          [
            L2GovernanceCommands.Queue,
            utils.defaultAbiCoder.encode(["uint256"], [proposalId]),
          ]
        ),
        destTokenAmounts: [],
      });

      const [scheduledEv] = (await tx.wait()).events;

      // Check and verify proposal state
      expect(await l2Governance.getTimelockHash(proposalId)).to.eq(
        scheduledEv.topics[1]
      );
      expect(await l2Governance.state(proposalId)).to.equal(1); // Queued
      expect(await l2Governor.isOperation(scheduledEv.topics[1])).to.be.true; // Scheduled

      await advanceBlocks((await l2Governor.getMinDelay()).add(10));

      // Check and verify proposal state
      expect(await l2Governance.state(proposalId)).to.equal(2); // Ready

      await l2Governance.connect(nick).execute(proposalId);

      // Check and verify proposal state
      expect(await l2Governance.state(proposalId)).to.equal(3); // Executed

      // Ensure that the actions have been executed
      expect(await woeth.hasRole(MINTER_ROLE, nick.address)).to.be.true;
    });

    it("Should allow Mainnet Governance to cancel queued transaction", async () => {
      const { l2Governance, l2Governor, ccipRouterSigner, executor } = fixture;

      const proposalId = await makeProposal();

      // Check and verify proposal state
      expect(await l2Governance.state(proposalId)).to.equal(0); // Pending

      const tx = await l2Governance.connect(ccipRouterSigner).ccipReceive({
        messageId:
          "0xdeadfeed00000000000000000000000000000000000000000000000000000000",
        sourceChainSelector: CCIPChainSelectors.Mainnet,
        sender: utils.defaultAbiCoder.encode(["address"], [executor.address]),
        data: utils.defaultAbiCoder.encode(
          ["bytes2", "bytes"],
          [
            L2GovernanceCommands.Queue,
            utils.defaultAbiCoder.encode(["uint256"], [proposalId]),
          ]
        ),
        destTokenAmounts: [],
      });

      const [scheduledEv] = (await tx.wait()).events;

      // Check and verify proposal state
      expect(await l2Governance.getTimelockHash(proposalId)).to.eq(
        scheduledEv.topics[1]
      );
      expect(await l2Governance.state(proposalId)).to.equal(1); // Queued
      expect(await l2Governor.isOperation(scheduledEv.topics[1])).to.be.true; // Scheduled

      await l2Governance.connect(ccipRouterSigner).ccipReceive({
        messageId:
          "0xdeadfeed00000000000000000000000000000000000000000000000000000000",
        sourceChainSelector: CCIPChainSelectors.Mainnet,
        sender: utils.defaultAbiCoder.encode(["address"], [executor.address]),
        data: utils.defaultAbiCoder.encode(
          ["bytes2", "bytes"],
          [
            L2GovernanceCommands.Cancel,
            utils.defaultAbiCoder.encode(["uint256"], [proposalId]),
          ]
        ),
        destTokenAmounts: [],
      });

      expect((await l2Governance.proposalDetails(proposalId)).exists).to.be
        .false;
      await expect(l2Governance.state(proposalId)).to.be.revertedWith(
        "InvalidProposal"
      );
    });
  });

  describe("CCIP Receiver", function () {
    it("Should revert when not called by CCIP Router", async () => {
      const { l2Governance, executor, rafael } = fixture;
      const tx = l2Governance.connect(rafael).ccipReceive({
        messageId:
          "0xdeadfeed00000000000000000000000000000000000000000000000000000000",
        sourceChainSelector: CCIPChainSelectors.Mainnet,
        sender: utils.defaultAbiCoder.encode(["address"], [executor.address]),
        data: utils.defaultAbiCoder.encode(
          ["bytes2", "bytes"],
          [
            L2GovernanceCommands.Queue,
            utils.defaultAbiCoder.encode(["uint256"], [1]),
          ]
        ),
        destTokenAmounts: [],
      });

      await expect(tx).to.be.revertedWith("InvalidRouter");
    });

    it("Should revert when message is not from Mainnet", async () => {
      const { l2Governance, executor, ccipRouterSigner } = fixture;
      const tx = l2Governance.connect(ccipRouterSigner).ccipReceive({
        messageId:
          "0xdeadfeed00000000000000000000000000000000000000000000000000000000",
        sourceChainSelector: "1234",
        sender: utils.defaultAbiCoder.encode(["address"], [executor.address]),
        data: utils.defaultAbiCoder.encode(
          ["bytes2", "bytes"],
          [
            L2GovernanceCommands.Queue,
            utils.defaultAbiCoder.encode(["uint256"], [1]),
          ]
        ),
        destTokenAmounts: [],
      });

      await expect(tx).to.be.revertedWith("InvalidSourceChainSelector");
    });

    it("Should revert when message is not from MainnetGovernanceExecutor", async () => {
      const { l2Governance, nick, ccipRouterSigner } = fixture;
      const tx = l2Governance.connect(ccipRouterSigner).ccipReceive({
        messageId:
          "0xdeadfeed00000000000000000000000000000000000000000000000000000000",
        sourceChainSelector: CCIPChainSelectors.Mainnet,
        sender: utils.defaultAbiCoder.encode(["address"], [nick.address]),
        data: utils.defaultAbiCoder.encode(
          ["bytes2", "bytes"],
          [
            L2GovernanceCommands.Queue,
            utils.defaultAbiCoder.encode(["uint256"], [1]),
          ]
        ),
        destTokenAmounts: [],
      });

      await expect(tx).to.be.revertedWith("NotMainnetExecutor");
    });

    it("Should revert on invalid command selector", async () => {
      const { l2Governance, executor, ccipRouterSigner } = fixture;
      const tx = l2Governance.connect(ccipRouterSigner).ccipReceive({
        messageId:
          "0xdeadfeed00000000000000000000000000000000000000000000000000000000",
        sourceChainSelector: CCIPChainSelectors.Mainnet,
        sender: utils.defaultAbiCoder.encode(["address"], [executor.address]),
        data: utils.defaultAbiCoder.encode(
          ["bytes2", "bytes"],
          ["0x0011", utils.defaultAbiCoder.encode(["uint256"], [1])]
        ),
        destTokenAmounts: [],
      });

      await expect(tx).to.be.revertedWith("InvalidGovernanceCommand");
    });
  });

  describe("Permissions", function () {
    it("Should allow L2Governance to be upgraded by Timelock", async () => {
      const { l2GovernanceProxy, governor, woeth } = fixture;

      // Pretend WOETH is the new implementation
      await l2GovernanceProxy.connect(governor).upgradeTo(woeth.address);
    });

    it("Should allow Timelock to be changed by Timelock", async () => {
      const { l2Governance, governor, woeth } = fixture;

      // Pretend WOETH is the new implementation
      await l2Governance.connect(governor).setTimelock(woeth.address);

      expect(await l2Governance.executor()).to.equal(woeth.address);
    });

    it("Should not allow anyone else to update Timelock", async () => {
      const { l2Governance, ccipRouterSigner } = fixture;

      await expect(
        l2Governance.connect(ccipRouterSigner).setTimelock(addresses.zero)
      ).to.be.revertedWith("NotL2Executor");
    });

    it("Should not allow empty address for Timelock", async () => {
      const { l2Governance, governor } = fixture;

      await expect(
        l2Governance.connect(governor).setTimelock(addresses.zero)
      ).to.be.revertedWith("EmptyAddress");
    });

    it("Should allow Executor to be changed by Timelock", async () => {
      const { l2Governance, governor, woeth } = fixture;

      // Pretend WOETH is the new implementation
      await l2Governance.connect(governor).setMainnetExecutor(woeth.address);

      expect(await l2Governance.mainnetExecutor()).to.equal(woeth.address);
    });

    it("Should not allow anyone else to update Executor", async () => {
      const { l2Governance, ccipRouterSigner } = fixture;

      await expect(
        l2Governance
          .connect(ccipRouterSigner)
          .setMainnetExecutor(addresses.zero)
      ).to.be.revertedWith("NotL2Executor");
    });

    it("Should not allow empty address for Executor", async () => {
      const { l2Governance, governor } = fixture;

      await expect(
        l2Governance.connect(governor).setMainnetExecutor(addresses.zero)
      ).to.be.revertedWith("EmptyAddress");
    });
  });

  describe("Config", function () {
    it("Should have correct Executor address", async () => {
      const { l2Governance } = fixture;
      expect((await l2Governance.mainnetExecutor()).toLowerCase()).to.eq(
        addresses.mainnet.MainnetGovernanceExecutorProxy.toLowerCase()
      );
    });

    it("Should have correct L2 Executor address", async () => {
      const { l2Governance, l2Governor } = fixture;
      expect((await l2Governance.executor()).toLowerCase()).to.eq(
        l2Governor.address.toLowerCase()
      );
    });

    it("Should have correct CCIP Router address", async () => {
      const { l2Governance } = fixture;
      expect((await l2Governance.getRouter()).toLowerCase()).to.eq(
        addresses.arbitrumOne.CCIPRouter.toLowerCase()
      );
    });

    it("Should be owned by timelock", async () => {
      const { l2GovernanceProxy, l2Governor } = fixture;
      const proxyOwner = await l2GovernanceProxy.governor();

      expect(proxyOwner.toLowerCase()).to.eq(l2Governor.address.toLowerCase());
    });

    it("Should have a 1 day timelock", async () => {
      const { l2Governor } = fixture;
      expect(await l2Governor.getMinDelay()).to.eq(86400);
    });
  });
});
