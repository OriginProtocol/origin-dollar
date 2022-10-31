const { expect } = require('chai');
const { bnDecimal, merkleProof, increaseTime, mineBlocks, 
        week, invalidMerkleProof, getBlock, bn } = require('../../../utils/governance-helpers');
const { deploymentFixture } = require('../fixture');

// Tests for MandatoryLockupDistributor
describe('Contract: MandatoryLockupDistributor', async () => {
    beforeEach(async () => {
        ({ ogv, veogv, mandatoryLockup, claimer } = await deploymentFixture());

        let amount = bnDecimal(500000000);
        // Transfer to the distributor contract so it has something to give out
        await ogv.transfer(mandatoryLockup.address, amount);
    })

  describe('Claiming', async () => {
      it('should reflect balance on claim with lockup', async () => {
        let amount = bnDecimal(500000000);
        // Claim and lock for a week
        let tx = await mandatoryLockup.connect(claimer).claim(1, amount, merkleProof);
        // Increase time for a week
        await increaseTime(week);
        await mineBlocks(1);
        tx = await tx.wait();
        let blockNum = Number(tx.blockNumber);
        let block = await getBlock(blockNum);
        let txTimestamp = bn(block.timestamp);

        let lockupOne = await veogv.lockups(claimer.address, 0)
        let lockupTwo = await veogv.lockups(claimer.address, 1)
        let lockupThree = await veogv.lockups(claimer.address, 2)
        let lockupFour = await veogv.lockups(claimer.address, 3)

        // assert lockups amounts are as expected
        expect(lockupOne[0]).to.be.eq(amount.div(4))
        expect(lockupTwo[0]).to.be.eq(amount.div(4))
        expect(lockupThree[0]).to.be.eq(amount.div(4))
        expect(lockupFour[0]).to.be.eq(amount.div(4))

        // assert timestamps are as expected
        // 1 month = 2629800
        let year = 2629800 * 12
        expect(lockupOne[1]).to.be.eq(txTimestamp.add(year))
        expect(lockupTwo[1]).to.be.eq(txTimestamp.add(year * 2))
        expect(lockupThree[1]).to.be.eq(txTimestamp.add(year * 3))
        expect(lockupFour[1]).to.be.eq(txTimestamp.add(year * 4))
      }),

      it('should\'t be able to claim if claim period has expired', async () => {
        let amount = bnDecimal(500000000);
        await mineBlocks(100);
        await expect(mandatoryLockup.connect(claimer).claim(1, amount, merkleProof)).
          to.be.revertedWith('Can no longer claim. Claim period expired')
      }),

      it('should be able to burn remaining ogv after claim period', async () => {
        await increaseTime(week);
        await mineBlocks(100);
        await mandatoryLockup.burnRemainingOGV();
        expect(await ogv.balanceOf(mandatoryLockup.address)).
          to.be.eq(0)
      }),

      it('should\'t be able to burn remaining ogv before claim period', async () => {
        await increaseTime(week);
        await mineBlocks(88); // claim block is set to 100 blocks after start one
        await expect(mandatoryLockup.burnRemainingOGV()).
          to.be.revertedWith('Can not yet burn the remaining OGV')
      }),

      it('should return true if proof is valid', async () => {
        let amount = bnDecimal(500000000);
        let valid = await mandatoryLockup.connect(claimer).isProofValid(
          1, amount, claimer.address, merkleProof
        )
        expect(valid).to.be.eq(true)
      }),

      it('should return false if proof is invalid', async () => {
        let amount = bnDecimal(500000000);
        let valid = await mandatoryLockup.connect(claimer).isProofValid(
          1, amount, claimer.address, invalidMerkleProof
        )
        expect(valid).to.be.eq(false)
      }),

      it('should\'t be able to claim with invalid proof', async () => {
        let amount = bnDecimal(500000000);
        await expect(mandatoryLockup.connect(claimer).claim(1, amount, invalidMerkleProof)).
          to.be.revertedWith('MerkleDistributor: Invalid proof.')
      })
  })
})
