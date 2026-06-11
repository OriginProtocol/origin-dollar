const { expect } = require("chai");
const { before } = require("mocha");

const { createFixtureLoader, beaconChainFixture } = require("../_fixture");
const { getBeaconBlock, getSlot, hashPubKey } = require("../../utils/beacon");
const {
  generateBalancesContainerProof,
  generateBalanceProof,
  generatePendingDepositsContainerProof,
  generatePendingDepositProof,
  generateValidatorPubKeyProof,
  generateValidatorWithdrawableEpochProof,
  generateFirstPendingDepositSlotProof,
} = require("../../utils/proofs");
const { MAX_UINT64 } = require("../../utils/constants");

const log = require("../../utils/logger")("test:fork:beacon:oracle");

const loadFixture = createFixtureLoader(beaconChainFixture);

const activeValidatorIndex = 1938267;
const activeValidatorWithdrawalCredential =
  "0x02000000000000000000000084750fc0837b32afdde943051b2634d05ced8e15";
const exitedValidatorIndex = 1998612;
const exitedValidatorWithdrawableEpoch = 384221;

describe("ForkTest: Beacon Proofs", function () {
  this.timeout(0);

  let blockView, blockTree;
  let stateView;
  let pastSlot;
  let beaconBlockRoot;
  before(async () => {
    const currentSlot = await getSlot();

    // Needs to be old enough so its before the local fork
    // But not too old that its before the beacon root oracle ring buffer
    pastSlot = Math.floor((currentSlot - 1000) / 1000) * 1000;

    ({ blockView, blockTree, stateView } = await getBeaconBlock(pastSlot));

    beaconBlockRoot = blockView.hashTreeRoot();
  });
  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should verify validator public key", async () => {
    const { beaconProofs } = fixture;

    const { proof, leaf, pubKey } = await generateValidatorPubKeyProof({
      blockView,
      blockTree,
      stateView,
      validatorIndex: activeValidatorIndex,
    });

    const pubKeyHash = hashPubKey(pubKey);
    expect(pubKeyHash).to.eq(leaf);

    log(`About to verify validator public key`);
    await beaconProofs.verifyValidator(
      beaconBlockRoot,
      pubKeyHash,
      proof,
      activeValidatorIndex,
      activeValidatorWithdrawalCredential
    );
  });

  async function assertValidatorWithdrawableEpoch(validatorIndex) {
    const { beaconProofs } = fixture;

    const { proof: withdrawableEpochProof, withdrawableEpoch } =
      await generateValidatorWithdrawableEpochProof({
        blockView,
        blockTree,
        stateView,
        validatorIndex,
      });

    log(`About to verify validator withdrawable epoch of ${withdrawableEpoch}`);
    await beaconProofs.verifyValidatorWithdrawable(
      beaconBlockRoot,
      validatorIndex,
      withdrawableEpoch,
      withdrawableEpochProof
    );

    return withdrawableEpoch;
  }

  it("Should verify validator withdrawable epoch that is not exiting", async () => {
    const withdrawableEpoch = await assertValidatorWithdrawableEpoch(
      activeValidatorIndex
    );
    expect(withdrawableEpoch).to.equal(MAX_UINT64);
  });
  it("Should verify validator withdrawable epoch that has exited", async () => {
    const withdrawableEpoch = await assertValidatorWithdrawableEpoch(
      exitedValidatorIndex
    );
    expect(withdrawableEpoch).to.equal(exitedValidatorWithdrawableEpoch);
  });

  it("Should verify balances container", async () => {
    const { beaconProofs } = fixture;

    const { proof, leaf } = await generateBalancesContainerProof({
      blockView,
      blockTree,
      stateView,
    });

    log(`About to verify balances container`);
    await beaconProofs.verifyBalancesContainer(beaconBlockRoot, leaf, proof);
  });

  it("Should verify validator balance in balances container", async () => {
    const { beaconProofs } = fixture;

    const { proof, leaf, root } = await generateBalanceProof({
      blockView,
      blockTree,
      stateView,
      validatorIndex: activeValidatorIndex,
    });

    log(`About to verify validator balance in balances container`);
    await beaconProofs.verifyValidatorBalance(
      root,
      leaf,
      proof,
      activeValidatorIndex
    );
  });

  it("Should verify pending deposits container", async () => {
    const { beaconProofs } = fixture;

    const { proof, leaf } = await generatePendingDepositsContainerProof({
      blockView,
      blockTree,
      stateView,
    });

    log(`About to verify pending deposits container`);
    await beaconProofs.verifyPendingDepositsContainer(
      beaconBlockRoot,
      leaf,
      proof
    );
  });

  it("Should verify a pending deposit in pending deposits container", async () => {
    const { beaconProofs } = fixture;

    // This will fail if there are not at least 3 deposits in the deposit queue
    const depositIndex = 2;

    const { proof, leaf, root } = await generatePendingDepositProof({
      blockView,
      blockTree,
      stateView,
      depositIndex,
    });

    log(`About to verify pending deposit in pending deposits container`);
    await beaconProofs.verifyPendingDeposit(root, leaf, proof, depositIndex);
  });

  it("Should verify the slot of the first pending deposit in the beacon block", async () => {
    const { beaconProofs } = fixture;

    const { proof, slot, root } = await generateFirstPendingDepositSlotProof({
      blockView,
      blockTree,
      stateView,
    });

    log(
      `About to verify the slot of the first pending deposit in the beacon block`
    );
    await beaconProofs.verifyFirstPendingDeposit(root, slot, proof);
  });
});
