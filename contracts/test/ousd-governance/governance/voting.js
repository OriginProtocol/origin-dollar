const { expect } = require('chai');
const { ethers } = require('hardhat');
const { bnDecimal, getBlockNumber, mineBlocks, increaseTime, week } = require('../../../utils/governance-helpers');
const { deploymentFixture } = require('../fixture');

// Tests for Governance
describe('Contract: Governance', async () => {
    beforeEach(async () => {
          ({ ogv, veogv, governance, timelock, rewardsSource } = await deploymentFixture());
          [admin, user1, user2, voter, ...addrs] = await ethers.getSigners();
    })

  describe('Voting', async () => {
      it('should be able to create a proposal', async () => {
        // Ethers needs to specify which function signature 
        // we're calling when there are overloaded functions
        let tx = await governance.connect(voter)
          ['propose(address[],uint256[],string[],bytes[],string)']
          (
            ["0xEA2Ef2e2E5A749D4A66b41Db9aD85a38Aa264cb3"],
            [0],
            ["upgradeTo(address)"],
            ["0x00000000000000000000000016156A06BD1BD2D80134EA1EE7E5FAEBDBFA20AA"],
            "Switch to new Convex implementation"
          )
        await mineBlocks(1);
        let quorum = await governance.quorum(tx.blockNumber);
        let totalSupply = await veogv.getPastTotalSupply(tx.blockNumber);
        expect(quorum).to.be.eq(totalSupply.div(5));
      }),

      it('should\'t be able to create a proposal if below minimum voting threshold', async () => {
        await expect(governance
          ['propose(address[],uint256[],string[],bytes[],string)']
          (
            ["0xEA2Ef2e2E5A749D4A66b41Db9aD85a38Aa264cb3"],
            [0],
            ["upgradeTo(address)"],
            ["0x00000000000000000000000016156A06BD1BD2D80134EA1EE7E5FAEBDBFA20AA"],
            "Switch to new Convex implementation"
          )).to.be.revertedWith('Governor: proposer votes below proposal threshold');
      }),

      it('should be able to cancel proposal', async () => {
        let tx = await governance.connect(voter)
          ['propose(address[],uint256[],string[],bytes[],string)']
          (
            [governance.address],
            [0],
            ["setVotingDelay(uint256)"],
            ["0x0000000000000000000000000000000000000000000000000000000000000064"],
            "Set voting delay"
          );
        await mineBlocks(1);
        tx = await tx.wait()
        let proposalId = tx.events[0].args.proposalId;
        await governance.connect(voter).cancel(proposalId)
        let state = await governance.state(proposalId);
        // State == 2 -> Cancelled
        expect(state).to.be.eq(2);
      }),

      it('should be able to pass proposal', async () => {
        let tx = await governance.connect(voter)
          ['propose(address[],uint256[],string[],bytes[],string)']
          (
            [governance.address],
            [0],
            ["setVotingDelay(uint256)"],
            ["0x0000000000000000000000000000000000000000000000000000000000000064"],
            "Set voting delay"
          );
        await mineBlocks(1);
        tx = await tx.wait()
        let proposalId = tx.events[0].args.proposalId;
        await governance.connect(voter).castVote(proposalId, 1);
        let state = await governance.state(proposalId);
        // Active == 1
        expect(state).to.be.eq(1);
        await mineBlocks(17281);
        // Passed == 4
        state = await governance.state(proposalId);
        expect(state).to.be.eq(4);
      }),

      it('should be able to defeat proposal', async () => {
        // Set up accounts for voting
        let amount = bnDecimal(1000);
        await ogv.transfer(user1.address, amount.mul(2))
        await ogv.approve(veogv.address, amount)
        await ogv.connect(user1).approve(veogv.address, amount.mul(2))
        await ogv.grantMinterRole(rewardsSource.address)
        await rewardsSource.setRewardsTarget(veogv.address)
        await veogv['stake(uint256,uint256,address)'](amount, week, admin.address)
        await veogv.connect(user1)['stake(uint256,uint256,address)']
          (amount.mul(2), week, user1.address)
        await veogv.delegate(admin.address)
        await veogv.connect(user1).delegate(user1.address)


        let tx = await governance.connect(voter)
          ['propose(address[],uint256[],string[],bytes[],string)']
          (
            [governance.address],
            [0],
            ["setVotingDelay(uint256)"],
            ["0x0000000000000000000000000000000000000000000000000000000000000064"],
            "Set voting delay"
          );
        await mineBlocks(1);

        tx = await tx.wait()
        let proposalId = tx.events[0].args.proposalId;
        await governance.castVote(proposalId, 1);
        await governance.connect(user1).castVote(proposalId, 0);
        let state = await governance.state(proposalId);
        // Active == 1
        expect(state).to.be.eq(1);
        await mineBlocks(17281);
        // Defeated == 3
        state = await governance.state(proposalId);
        expect(state).to.be.eq(3);
      }),

      it('should be able to queue and execute proposal', async () => {
        let tx = await governance.connect(voter)
          ['propose(address[],uint256[],string[],bytes[],string)']
          (
            [governance.address],
            [0],
            ["setVotingDelay(uint256)"],
            ["0x0000000000000000000000000000000000000000000000000000000000000064"],
            "Set voting delay"
          );
        await mineBlocks(1);
        tx = await tx.wait()
        let proposalId = tx.events[0].args.proposalId;
        await governance.connect(voter).castVote(proposalId, 1);
        await mineBlocks(17281);
        await governance.connect(voter)['queue(uint256)'](proposalId);
        // Queued == 5
        let state = await governance.state(proposalId);
        expect(state).to.be.eq(5);
        // Increase time to be able to execute
        await increaseTime(86400 * 2);
        await mineBlocks(1);
        await governance.connect(voter)['execute(uint256)'](proposalId);
        // Executed == 7
        state = await governance.state(proposalId);
        expect(state).to.be.eq(7);
      }),

      it('late vote should extend quorum', async () => {
        let tx = await governance.connect(voter)
          ['propose(address[],uint256[],string[],bytes[],string)']
          (
            [governance.address],
            [0],
            ["setVotingDelay(uint256)"],
            ["0x0000000000000000000000000000000000000000000000000000000000000064"],
            "Set voting delay"
          );
        await mineBlocks(17265); // less than required for vote end
        tx = await tx.wait()
        let proposalId = tx.events[0].args.proposalId;
        let state = await governance.state(proposalId);
        // Active == 1
        expect(state).to.be.eq(1);
        await governance.connect(voter).castVote(proposalId, 1);
        // Get proposal end date
        let proposal = await governance.proposals(proposalId);
        let proposalEndBlock = proposal[4];
        // extends for two days past the current block
        let expectedEndBlock = (86400 / 15) * 2 + await getBlockNumber();
        expect(proposalEndBlock).to.be.eq(expectedEndBlock);
      }),

      it('should be able to cancel already queued proposal', async () => {
        let tx = await governance.connect(voter)
          ['propose(address[],uint256[],string[],bytes[],string)']
          (
            [governance.address],
            [0],
            ["setVotingDelay(uint256)"],
            ["0x0000000000000000000000000000000000000000000000000000000000000064"],
            "Set voting delay"
          );
        await mineBlocks(1);
        tx = await tx.wait()
        let proposalId = tx.events[0].args.proposalId;
        await governance.connect(voter).castVote(proposalId, 1);
        await mineBlocks(17281);
        await governance.connect(voter)['queue(uint256)'](proposalId);
        // Queued == 5
        let state = await governance.state(proposalId);
        expect(state).to.be.eq(5);
        await governance.connect(voter)['cancel(uint256)'](proposalId);
        // Cancelled == 2
        state = await governance.state(proposalId);
        expect(state).to.be.eq(2);
        // Should revert on attempt to cancel again
        await expect(governance.connect(voter)['cancel(uint256)'](proposalId)).
            to.be.revertedWith('Governor: proposal not active')
      }),

      it('should be able to cancel already queued proposal after time passes', async () => {
        let tx = await governance.connect(voter)
          ['propose(address[],uint256[],string[],bytes[],string)']
          (
            [governance.address],
            [0],
            ["setVotingDelay(uint256)"],
            ["0x0000000000000000000000000000000000000000000000000000000000000064"],
            "Set voting delay"
          );
        await mineBlocks(1);
        tx = await tx.wait()
        let proposalId = tx.events[0].args.proposalId;
        await governance.connect(voter).castVote(proposalId, 1);
        await mineBlocks(17281);
        await governance.connect(voter)['queue(uint256)'](proposalId);
        // Queued == 5
        let state = await governance.state(proposalId);
        expect(state).to.be.eq(5);
        // Increase time
        await increaseTime(86400 * 2);
        await mineBlocks(1);
        await governance.connect(voter)['cancel(uint256)'](proposalId);
        // Cancelled == 2
        state = await governance.state(proposalId);
        expect(state).to.be.eq(2);
      }),

      it('should\'t be able to cancel proposal after it has been executed', async () => {
        let tx = await governance.connect(voter)
          ['propose(address[],uint256[],string[],bytes[],string)']
          (
            [governance.address],
            [0],
            ["setVotingDelay(uint256)"],
            ["0x0000000000000000000000000000000000000000000000000000000000000064"],
            "Set voting delay"
          );
        await mineBlocks(1);
        tx = await tx.wait()
        let proposalId = tx.events[0].args.proposalId;
        await governance.connect(voter).castVote(proposalId, 1);
        await mineBlocks(17281);
        await governance.connect(voter)['queue(uint256)'](proposalId);
        // Queued == 5
        let state = await governance.state(proposalId);
        expect(state).to.be.eq(5);
        // Increase time to be able to execute
        await increaseTime(86400 * 2);
        await mineBlocks(1);
        await governance.connect(voter)['execute(uint256)'](proposalId);
        // Executed == 7
        state = await governance.state(proposalId);
        expect(state).to.be.eq(7);
        expect(await governance.votingDelay()).to.be.eq(100);

        // Should revert on attempt to cancel
        await expect(governance.connect(voter)['cancel(uint256)'](proposalId)).
            to.be.revertedWith('Governor: proposal not active')
      })
  })
})
