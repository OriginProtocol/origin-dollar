const { expect } = require("chai");
const { before } = require("mocha");

const { createFixtureLoader, beaconChainFixture } = require("../_fixture");
const { getBeaconBlock, getSlot, hashPubKey } = require("../../utils/beacon");
const {
  generateBalancesContainerProof,
  generateBalanceProof,
  generateValidatorPubKeyProof,
  generateValidatorWithdrawableEpochProof,
  generateFirstPendingDepositPubKeyProof,
  generateFirstPendingDepositSlotProof,
} = require("../../utils/proofs");
const { MAX_UINT64 } = require("../../utils/constants");

const log = require("../../utils/logger")("test:fork:beacon:oracle");

const loadFixture = createFixtureLoader(beaconChainFixture);

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

    const validatorIndex = 1804300;

    const { proof, leaf, pubKey } = await generateValidatorPubKeyProof({
      blockView,
      blockTree,
      stateView,
      validatorIndex,
    });

    const pubKeyHash = hashPubKey(pubKey);
    expect(pubKeyHash).to.eq(leaf);

    const withdrawalAddress = "0xf80432285c9d2055449330bbd7686a5ecf2a7247";

    log(`About to verify validator public key`);
    await beaconProofs.verifyValidator(
      beaconBlockRoot,
      pubKeyHash,
      proof,
      validatorIndex,
      withdrawalAddress
    );
  });

  async function assertValidatorWithdrawableEpoch(
    validatorIndex,
    publicKeyHash
  ) {
    const { beaconProofs } = fixture;

    const {
      proof: withdrawableEpochProof,
      withdrawableEpoch,
      validatorPubKeyProof,
    } = await generateValidatorWithdrawableEpochProof({
      blockView,
      blockTree,
      stateView,
      validatorIndex,
      includePubKeyProof: true,
    });

    log(`About to verify validator withdrawable epoch of ${withdrawableEpoch}`);
    await beaconProofs[
      "verifyValidatorWithdrawable(bytes32,uint64,uint64,bytes)"
    ](
      beaconBlockRoot,
      validatorIndex,
      withdrawableEpoch,
      withdrawableEpochProof
    );

    log(`About to verify validator withdrawable epoch with pub key proof`);
    await beaconProofs[
      "verifyValidatorWithdrawable(bytes32,uint64,bytes32,uint64,bytes,bytes)"
    ](
      beaconBlockRoot,
      validatorIndex,
      publicKeyHash,
      withdrawableEpoch,
      withdrawableEpochProof,
      validatorPubKeyProof
    );

    return withdrawableEpoch;
  }

  it("Should verify validator withdrawable epoch that is not exiting", async () => {
    const validatorIndex = 1804301;
    const publicKeyHash = hashPubKey(
      "0x8c12ae36c815c9673521f7fa27c89fb6e3a631adea7525c85634e046171b64d0950a7740639a01e6c71cb2693c4a7254"
    );

    const withdrawableEpoch = await assertValidatorWithdrawableEpoch(
      validatorIndex,
      publicKeyHash
    );
    expect(withdrawableEpoch).to.equal(MAX_UINT64);
  });
  it("Should verify validator withdrawable epoch that has exited", async () => {
    const validatorIndex = 1804300;
    const publicKeyHash = hashPubKey(
      "0xb7f9535308c82321e0c155f490798604c8ee53fbaf13bd56fb240e01977e60c5998e775415765d88481fa20652da1e31"
    );

    const withdrawableEpoch = await assertValidatorWithdrawableEpoch(
      validatorIndex,
      publicKeyHash
    );
    expect(withdrawableEpoch).to.equal(380333);
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

    const validatorIndex = 1804300;

    const { proof, leaf, root } = await generateBalanceProof({
      blockView,
      blockTree,
      stateView,
      validatorIndex,
    });

    log(`About to verify validator balance in balances container`);
    await beaconProofs.verifyValidatorBalance(
      root,
      leaf,
      proof,
      validatorIndex
    );
  });

  it("Should verify the slot of the first pending deposit and check its not withdrawable in the beacon block", async () => {
    const { beaconProofs } = fixture;

    const { proof, slot, root, pubkeyHash } =
      await generateFirstPendingDepositPubKeyProof({
        blockView,
        blockTree,
        stateView,
      });

    log(
      `About to verify the slot of the first pending deposit in the beacon block`
    );
    await beaconProofs[
      "verifyFirstPendingDeposit(bytes32,uint64,bytes32,bytes)"
    ](root, slot, pubkeyHash, proof);
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
    await beaconProofs["verifyFirstPendingDeposit(bytes32,uint64,bytes)"](
      root,
      slot,
      proof
    );
  });
});
