const { expect } = require("chai");
const { before } = require("mocha");

const { createFixtureLoader, beaconChainFixture } = require("../_fixture");
const { getBeaconBlock, getSlot, hashPubKey } = require("../../utils/beacon");
const {
  generateStateProof,
  generateBalancesContainerProof,
  generateBalanceProof,
  generateValidatorPubKeyProof,
  generateFirstPendingDepositProofs,
} = require("../../utils/proofs");

const log = require("../../utils/logger")("test:fork:beacon:oracle");

const loadFixture = createFixtureLoader(beaconChainFixture);

describe("ForkTest: Beacon Proofs", function () {
  this.timeout(0);

  let blockView, blockTree;
  let stateView, stateTree;
  let pastSlot;
  let beaconBlockRoot;
  let stateRoot;
  before(async () => {
    const currentSlot = await getSlot();

    // Needs to be old enough so its before the local fork
    // But not too old that its before the beacon root oracle ring buffer
    pastSlot = Math.floor((currentSlot - 1000) / 1000) * 1000;

    ({ blockView, blockTree, stateView, stateTree } = await getBeaconBlock(
      pastSlot
    ));

    beaconBlockRoot = blockView.hashTreeRoot();
    stateRoot = stateView.hashTreeRoot();
  });
  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should verify state in beacon block", async () => {
    const { beaconProofs } = fixture;

    const { proof } = await generateStateProof({
      blockView,
      blockTree,
    });

    log(`About to verify state in beacon block`);
    await beaconProofs.verifyState(beaconBlockRoot, stateRoot, proof);
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

  it("Should verify balances container", async () => {
    const { beaconProofs } = fixture;

    const { proof, leaf } = await generateBalancesContainerProof({
      stateView,
      stateTree,
    });

    log(`About to verify balances container`);
    await beaconProofs.verifyBalancesContainer(stateRoot, leaf, proof);
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

  it("Should verify the slot of the first pending deposit in the beacon block", async () => {
    const { beaconProofs } = fixture;

    const { stateRoot, firstPendingDeposit, firstPendingDepositValidator } =
      await generateFirstPendingDepositProofs({
        stateView,
        stateTree,
      });

    log(
      `About to verify the slot of the first pending deposit in the beacon block`
    );
    await beaconProofs.verifyFirstPendingDeposit(
      stateRoot,
      firstPendingDeposit,
      firstPendingDepositValidator
    );
  });
});
