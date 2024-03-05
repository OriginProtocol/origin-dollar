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

  const getProposalData = (proposalId, commandId) => {
    return utils.defaultAbiCoder.encode(
      ["bytes2", "bytes"],
      [commandId, utils.defaultAbiCoder.encode(["uint256"], [proposalId])]
    );
  };

  describe("Create Proposal", () => {
    it("should allow anyone to propose", async () => {
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

    it("should revert if no actions", async () => {
      const { l2Governance, nick } = fixture;

      const tx = l2Governance.connect(nick).propose([], [], [], [], "");

      await expect(tx).to.be.revertedWith("EmptyProposal");
    });

    it("should revert on duplicate proposal", async () => {
      const { l2Governance, nick } = fixture;

      const proposalId = await makeProposal();
      const [targets, values, signatures, calldatas] =
        await l2Governance.getActions(proposalId);

      const tx = l2Governance
        .connect(nick)
        .propose(targets, values, signatures, calldatas, "");

      await expect(tx).to.be.revertedWith("DuplicateProposal");
    });

    it("should revert if args are invalid", async () => {
      const { l2Governance, rafael, nick, woeth } = fixture;

      let tx = l2Governance
        .connect(rafael)
        .propose(
          [woeth.address, woeth.address],
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

      await expect(tx).to.be.revertedWith("InvalidProposalLength");

      tx = l2Governance
        .connect(rafael)
        .propose(
          [woeth.address],
          [0, 0],
          ["grantRole(bytes32,address)"],
          [
            utils.defaultAbiCoder.encode(
              ["bytes32", "address"],
              [MINTER_ROLE, nick.address]
            ),
          ],
          ""
        );

      await expect(tx).to.be.revertedWith("InvalidProposalLength");

      tx = l2Governance
        .connect(rafael)
        .propose(
          [woeth.address],
          [0],
          [],
          [
            utils.defaultAbiCoder.encode(
              ["bytes32", "address"],
              [MINTER_ROLE, nick.address]
            ),
          ],
          ""
        );

      await expect(tx).to.be.revertedWith("InvalidProposalLength");

      tx = l2Governance
        .connect(rafael)
        .propose(
          [woeth.address, woeth.address],
          [0],
          ["grantRole(bytes32,address)"],
          [],
          ""
        );
      await expect(tx).to.be.revertedWith("InvalidProposalLength");
    });
  });

  describe("Queue Proposal", () => {
    it("should allow Mainnet Governance Executor to queue through CCIP", async () => {
      const { mockCCIPRouter, l2Governance, l2Governor, executor, rafael } =
        fixture;

      const proposalId = await makeProposal();

      // Check and verify proposal
      expect(await l2Governance.state(proposalId)).to.equal(0); // Pending

      // Queue
      const tx = await mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Queue),
          []
        );

      // Should've queued it on Timelock/L2Governor
      const [timelockEvents] = (await tx.wait()).events;
      expect(await l2Governance.getTimelockHash(proposalId)).to.eq(
        timelockEvents.topics[1]
      );
      expect(await l2Governance.state(proposalId)).to.equal(1); // Queued
      expect(await l2Governor.isOperation(timelockEvents.topics[1])).to.be.true; // Scheduled
    });

    it("should not queue proposal if it does not exists", async () => {
      const { mockCCIPRouter, l2Governance, executor, rafael } = fixture;

      const tx = mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(1010, L2GovernanceCommands.Queue),
          []
        );

      await expect(tx).to.be.revertedWith("InvalidProposal");
    });

    it("should not queue proposal if it's already queued", async () => {
      const { mockCCIPRouter, l2Governance, executor, rafael } = fixture;

      const proposalId = await makeProposal();
      expect(await l2Governance.state(proposalId)).to.equal(0); // Pending

      // Queue
      await mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Queue),
          []
        );
      expect(await l2Governance.state(proposalId)).to.equal(1); // Queued

      // Try Queueing again
      const tx = mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Queue),
          []
        );
      await expect(tx).to.be.revertedWith("InvalidProposalState");
    });

    it("should not queue proposal if it's already ready", async () => {
      const { mockCCIPRouter, l2Governance, l2Governor, executor, rafael } =
        fixture;

      const proposalId = await makeProposal();
      expect(await l2Governance.state(proposalId)).to.equal(0); // Pending

      // Queue
      await mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Queue),
          []
        );
      expect(await l2Governance.state(proposalId)).to.equal(1); // Queued

      // Wait for timelock
      await advanceBlocks((await l2Governor.getMinDelay()).add(10));

      // Check and verify proposal state
      expect(await l2Governance.state(proposalId)).to.equal(2); // Ready

      // Try Queueing again
      const tx = mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Queue),
          []
        );
      await expect(tx).to.be.revertedWith("InvalidProposalState");
    });

    it("should not queue proposal if it's already executed", async () => {
      const { mockCCIPRouter, l2Governance, l2Governor, executor, nick } =
        fixture;

      const proposalId = await makeProposal();
      expect(await l2Governance.state(proposalId)).to.equal(0); // Pending

      // Queue
      await mockCCIPRouter
        .connect(nick)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Queue),
          []
        );
      expect(await l2Governance.state(proposalId)).to.equal(1); // Queued

      // Wait for timelock
      await advanceBlocks((await l2Governor.getMinDelay()).add(10));

      // Check and verify proposal state
      expect(await l2Governance.state(proposalId)).to.equal(2); // Ready

      // Execute
      await l2Governance.connect(nick).execute(proposalId);

      // Check and verify proposal state
      expect(await l2Governance.state(proposalId)).to.equal(3); // Executed

      // Try Queueing again
      const tx = mockCCIPRouter
        .connect(nick)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Queue),
          []
        );
      await expect(tx).to.be.revertedWith("InvalidProposalState");
    });
  });

  describe("Proposal Execution", () => {
    it("should show correct state after timelock has lapsed", async () => {
      const { mockCCIPRouter, l2Governance, l2Governor, executor, rafael } =
        fixture;

      const proposalId = await makeProposal();
      expect(await l2Governance.state(proposalId)).to.equal(0); // Pending

      // Queue
      await mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Queue),
          []
        );
      expect(await l2Governance.state(proposalId)).to.equal(1); // Queued

      // Wait for timelock
      await advanceBlocks((await l2Governor.getMinDelay()).add(10));

      // Check and verify proposal state
      expect(await l2Governance.state(proposalId)).to.equal(2); // Ready
    });

    it("should allow execution after timelock", async () => {
      const {
        mockCCIPRouter,
        l2Governance,
        l2Governor,
        executor,
        woeth,
        nick,
        rafael,
      } = fixture;

      const proposalId = await makeProposal();
      expect(await l2Governance.state(proposalId)).to.equal(0); // Pending

      // Queue
      await mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Queue),
          []
        );
      expect(await l2Governance.state(proposalId)).to.equal(1); // Queued

      // Wait for timelock
      await advanceBlocks((await l2Governor.getMinDelay()).add(10));

      // Check and verify proposal state
      expect(await l2Governance.state(proposalId)).to.equal(2); // Ready

      // Execute
      await l2Governance.connect(nick).execute(proposalId);

      // Check and verify proposal state
      expect(await l2Governance.state(proposalId)).to.equal(3); // Executed

      // Ensure that the actions have been executed
      expect(await woeth.hasRole(MINTER_ROLE, nick.address)).to.be.true;
    });

    it("should not allow execution if proposal isn't ready", async () => {
      const { mockCCIPRouter, l2Governance, executor, nick, rafael } = fixture;

      const proposalId = await makeProposal();
      expect(await l2Governance.state(proposalId)).to.equal(0); // Pending

      // Try Execute
      await expect(
        l2Governance.connect(nick).execute(proposalId)
      ).to.be.revertedWith("InvalidProposalState");

      // Queue
      await mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Queue),
          []
        );
      expect(await l2Governance.state(proposalId)).to.equal(1); // Queued

      // Try Execute
      await expect(
        l2Governance.connect(nick).execute(proposalId)
      ).to.be.revertedWith("InvalidProposalState");
    });

    it("should not allow execution of unknown proposal", async () => {
      const { l2Governance, nick } = fixture;

      // Try Execute
      await expect(l2Governance.connect(nick).execute(1000)).to.be.revertedWith(
        "InvalidProposal"
      );
    });
  });

  describe("Proposal Cancelation", () => {
    it("should allow cancelling of queued proposals", async () => {
      const { mockCCIPRouter, l2Governance, executor, rafael } = fixture;

      const proposalId = await makeProposal();
      expect(await l2Governance.state(proposalId)).to.equal(0); // Pending

      // Queue
      await mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Queue),
          []
        );
      expect(await l2Governance.state(proposalId)).to.equal(1); // Queued

      // Cancel
      await mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Cancel),
          []
        );
      await expect(l2Governance.state(proposalId)).to.be.revertedWith(
        "InvalidProposal"
      );
    });

    it("should not cancel proposal if it's already executed", async () => {
      const { mockCCIPRouter, l2Governance, l2Governor, executor, nick } =
        fixture;

      const proposalId = await makeProposal();
      expect(await l2Governance.state(proposalId)).to.equal(0); // Pending

      // Queue
      await mockCCIPRouter
        .connect(nick)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Queue),
          []
        );
      expect(await l2Governance.state(proposalId)).to.equal(1); // Queued

      // Wait for timelock
      await advanceBlocks((await l2Governor.getMinDelay()).add(10));

      // Check and verify proposal state
      expect(await l2Governance.state(proposalId)).to.equal(2); // Ready

      // Execute
      await l2Governance.connect(nick).execute(proposalId);

      // Check and verify proposal state
      expect(await l2Governance.state(proposalId)).to.equal(3); // Executed

      // Try Queueing again
      const tx = mockCCIPRouter
        .connect(nick)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(proposalId, L2GovernanceCommands.Cancel),
          []
        );
      await expect(tx).to.be.revertedWith("InvalidProposalState");
    });

    it("should not cancel proposal if it doesn't exist", async () => {
      const { mockCCIPRouter, l2Governance, executor, rafael } = fixture;

      // Try Queueing again
      const tx = mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(10023, L2GovernanceCommands.Cancel),
          []
        );
      await expect(tx).to.be.revertedWith("InvalidProposal");
    });
  });

  describe("CCIP Message Handling", () => {
    it("should not accept message if not from mainnet", async () => {
      const { mockCCIPRouter, l2Governance, executor, rafael } = fixture;

      const tx = mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.ArbitrumOne,
          executor.address,
          getProposalData(1010, L2GovernanceCommands.Queue),
          []
        );

      await expect(tx).to.be.revertedWith("InvalidSourceChainSelector");
    });

    it("should not accept messages if not from mainnet executor", async () => {
      const { mockCCIPRouter, l2Governance, l2Governor, rafael } = fixture;

      for (const signer of [l2Governor, rafael, mockCCIPRouter]) {
        const tx = mockCCIPRouter
          .connect(rafael)
          .mockSend(
            l2Governance.address,
            CCIPChainSelectors.Mainnet,
            signer.address,
            getProposalData(1010, L2GovernanceCommands.Queue),
            []
          );

        await expect(tx).to.be.revertedWith("NotMainnetExecutor");
      }
    });

    it("should not accept messages if bridge is cursed", async () => {
      const { mockCCIPRouter, executor, l2Governance, rafael } = fixture;

      // Curse the Router
      await mockCCIPRouter.connect(rafael).setIsCursed(true);

      const tx = mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(1010, L2GovernanceCommands.Queue),
          []
        );

      await expect(tx).to.be.revertedWith("CCIPRouterIsCursed");
    });

    it("should not accept messages if there are token transfers", async () => {
      const { mockCCIPRouter, executor, l2Governance, rafael, woeth } = fixture;

      const tx = mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(1010, L2GovernanceCommands.Queue),
          [[woeth.address, "100"]]
        );

      await expect(tx).to.be.revertedWith("TokenTransfersNotAccepted");
    });

    it("should not accept messages with invalid governance commands", async () => {
      const { mockCCIPRouter, executor, l2Governance, rafael } = fixture;

      const tx = mockCCIPRouter
        .connect(rafael)
        .mockSend(
          l2Governance.address,
          CCIPChainSelectors.Mainnet,
          executor.address,
          getProposalData(1010, "0x0003"),
          []
        );

      await expect(tx).to.be.revertedWith("InvalidGovernanceCommand");
    });
  });

  describe("Proposal State", function () {
    it("should revert for non-existent proposals", async () => {
      const { l2Governance } = fixture;

      await expect(l2Governance.state(1000)).to.be.revertedWith(
        "InvalidProposal"
      );
    });

    it("should not return actions for non-existent proposals", async () => {
      const { l2Governance } = fixture;

      await expect(l2Governance.getActions(1000)).to.be.revertedWith(
        "InvalidProposal"
      );
    });

    it("should not return hash for non-existent proposals", async () => {
      const { l2Governance } = fixture;

      await expect(l2Governance.getTimelockHash(1000)).to.be.revertedWith(
        "InvalidProposal"
      );
    });
  });

  describe("Config & Permissions", function () {
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
      const { l2Governance, rafael } = fixture;

      await expect(
        l2Governance.connect(rafael).setTimelock(addresses.dead)
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
      const { l2Governance, rafael } = fixture;

      await expect(
        l2Governance.connect(rafael).setMainnetExecutor(addresses.dead)
      ).to.be.revertedWith("NotL2Executor");
    });

    it("Should not allow empty address for Executor", async () => {
      const { l2Governance, governor } = fixture;

      await expect(
        l2Governance.connect(governor).setMainnetExecutor(addresses.zero)
      ).to.be.revertedWith("EmptyAddress");
    });

    it("initialization should revert if empty address is passed", async () => {
      const { nick } = fixture;
      const l2GovernanceImpl = await hre.ethers.getContract("L2Governance");

      await expect(
        l2GovernanceImpl
          .connect(nick)
          .initialize(addresses.zero, addresses.dead)
      ).to.be.revertedWith("EmptyAddress");

      await expect(
        l2GovernanceImpl
          .connect(nick)
          .initialize(addresses.dead, addresses.zero)
      ).to.be.revertedWith("EmptyAddress");
    });
  });
});
