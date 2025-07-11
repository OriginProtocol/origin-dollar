const { expect } = require("chai");
const { before } = require("mocha");

const { createFixtureLoader, beaconChainFixture } = require("../_fixture");
const { getBeaconBlock, getSlot, hashPubKey } = require("../../utils/beacon");
const {
  generateBalancesContainerProof,
  generateBlockProof,
  generateSlotProof,
  generateValidatorPubKeyProof,
} = require("../../utils/proofs");

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

  it("Should verify a block", async () => {
    const { beaconProofs } = fixture;

    const pastBlockNumber = blockView.body.executionPayload.blockNumber;
    log(`Beacon block number: ${pastBlockNumber}`);

    const { proof } = await generateBlockProof({
      blockView,
      blockTree,
    });

    log(`About to verify block`);
    await beaconProofs.verifyBlockNumber(
      beaconBlockRoot,
      pastBlockNumber,
      proof
    );
  });

  it("Should verify a slot", async () => {
    const { beaconProofs } = fixture;

    log(`Beacon slot: ${blockView.slot}`);

    const { proof } = await generateSlotProof({
      blockView,
      blockTree,
    });

    log(`About to verify slot`);
    await beaconProofs.verifySlot(beaconBlockRoot, pastSlot, proof);
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

    log(`About to verify validator public key`);
    await beaconProofs.verifyValidatorPubkey(
      beaconBlockRoot,
      pubKeyHash,
      proof,
      validatorIndex
    );
  });
});
