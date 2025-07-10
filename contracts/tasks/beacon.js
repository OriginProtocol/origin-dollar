const addresses = require("../utils/addresses");
const { getBeaconBlock, getSlot } = require("../utils/beacon");
const { getSigner } = require("../utils/signers");
const { resolveContract } = require("../utils/resolvers");
const { generateSlotProof, generateBlockProof } = require("../utils/proofs");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:beacon");

async function depositValidator({ pubkey, cred, sig, root, amount }) {
  const signer = await getSigner();

  const depositContract = await ethers.getContractAt(
    "IDepositContract",
    addresses.mainnet.beaconChainDepositContract,
    signer
  );

  const tx = await depositContract.deposit(pubkey, cred, sig, root, {
    value: ethers.utils.parseEther(amount.toString()),
  });
  await logTxDetails(tx, "deposit to validator");
}

async function verifySlot({ block }) {
  const signer = await getSigner();

  // Get provider to mainnet and not a local fork
  const provider = getProvider();

  // Get the timestamp of the next block
  const nextBlock = block + 1;
  const { timestamp: nextBlockTimestamp } = await provider.getBlock(nextBlock);
  log(`next block ${nextBlock} has timestamp ${nextBlockTimestamp}`);

  // Get the parent block root from the beacon roots contract
  const mockBeaconRoots = await ethers.getContract("MockBeaconRoots");
  const parentBlockRoot = await mockBeaconRoots.parentBlockRoot(
    nextBlockTimestamp
  );
  log(`Parent block root for block ${nextBlock} is ${parentBlockRoot}`);

  const slot = await getSlot(parentBlockRoot);
  log(`Slot for block ${block} is:`, slot);

  const { blockView, blockTree } = await getBeaconBlock(slot);

  const slotProofBytes = await generateSlotProof({
    blockView,
    blockTree,
  });

  const blockNumberProofBytes = await generateBlockProof({
    blockView,
    blockTree,
  });

  const oracle = await resolveContract("BeaconOracle");

  log(`About map ${block} to ${slot}`);
  const tx = await oracle
    .connect(signer)
    .verifySlot(
      nextBlockTimestamp,
      block,
      slot,
      slotProofBytes,
      blockNumberProofBytes
    );
  await logTxDetails(tx, "verifySlot");
}

function getProvider() {
  // Get provider to Ethereum mainnet and not a local fork
  return new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
}

async function blockToSlot({ block }) {
  const oracle = await resolveContract("BeaconOracle");

  const slot = await oracle.blockToSlot(block);

  console.log(`Block ${block} maps to slot ${slot}`);

  return slot;
}

async function slotToBlock({ slot }) {
  const oracle = await resolveContract("BeaconOracle");

  const block = await oracle.slotToBlock(slot);

  console.log(`Slot ${slot} maps to block ${block}`);

  return block;
}

module.exports = {
  depositValidator,
  verifySlot,
  blockToSlot,
  slotToBlock,
};
