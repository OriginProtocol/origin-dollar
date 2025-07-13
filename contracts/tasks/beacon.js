const { formatUnits } = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const { getBeaconBlock, getSlot } = require("../utils/beacon");
const { getSigner } = require("../utils/signers");
const { resolveContract } = require("../utils/resolvers");
const {
  generateSlotProof,
  generateBlockProof,
  generateValidatorPubKeyProof,
  generateFirstPendingDepositSlotProof,
  generateBalancesContainerProof,
  generateBalanceProof,
} = require("../utils/proofs");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:beacon");

function getProvider() {
  // Get provider to Ethereum mainnet and not a local fork
  return new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
}

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
  const blockRoot = await mockBeaconRoots.parentBlockRoot(nextBlockTimestamp);
  log(`Beacon block root for block ${block} is ${blockRoot}`);

  const slot = await getSlot(blockRoot);
  log(`Slot for block ${block} is:`, slot);

  const { blockView, blockTree } = await getBeaconBlock(slot);

  const { proof: slotProofBytes } = await generateSlotProof({
    blockView,
    blockTree,
  });

  const { proof: blockNumberProofBytes } = await generateBlockProof({
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

async function verifyValidator({ slot, index }) {
  const signer = await getSigner();

  const { blockView, blockTree, stateView } = await getBeaconBlock(slot);

  // Get provider to mainnet and not a local fork
  const provider = getProvider();

  const nextBlock = blockView.body.executionPayload.blockNumber + 1;
  const { timestamp: nextBlockTimestamp } = await provider.getBlock(nextBlock);
  log(
    `Next execution layer block ${nextBlock} has timestamp ${nextBlockTimestamp}`
  );

  const {
    proof,
    leaf: pubKeyHash,
    pubKey,
  } = await generateValidatorPubKeyProof({
    validatorIndex: index,
    blockView,
    blockTree,
    stateView,
  });

  const strategy = await resolveContract("CompoundingStakingSSVStrategy");

  log(
    `About verify validator ${index} with pub key ${pubKey} using slot ${slot}`
  );
  const tx = await strategy
    .connect(signer)
    .verifyValidator(nextBlockTimestamp, index, pubKeyHash, proof);
  await logTxDetails(tx, "verifyValidator");
}

async function verifyDeposit({ block, slot, root }) {
  const signer = await getSigner();

  // TODO If no block then get the block from the stakeETH event
  // For now we'll throw an error
  if (!block) throw Error("Block is currently required for verifyDeposit");

  // Check the deposit block has been mapped in the Beacon Oracle
  const oracle = await resolveContract("BeaconOracle");
  const isMapped = await oracle.isBlockMapped(block);
  if (!isMapped) {
    await verifySlot({ block });
  }

  // Uses the latest slot if the slot is undefined
  const { blockView, blockTree, stateView } = await getBeaconBlock(slot);

  const processedSlot = blockView.slot;

  const strategy = await resolveContract("CompoundingStakingSSVStrategy");

  const { proof, slot: firstPendingDepositSlot } =
    await generateFirstPendingDepositSlotProof({
      blockView,
      blockTree,
      stateView,
    });

  log(
    `About verify deposit for block ${block} and slot ${slot} with deposit data root ${root}`
  );
  const tx = await strategy
    .connect(signer)
    .verifyDeposit(root, block, processedSlot, firstPendingDepositSlot, proof);
  await logTxDetails(tx, "verifyDeposit");
}

async function verifyBalances({ root }) {
  const signer = await getSigner();

  // TODO If no beacon block root, then get from the blockRoot from the last BalancesSnapped event
  // Revert for now
  if (!root)
    throw Error("Beacon block root is currently required for verifyBalances");

  // Uses the beacon chain data for the beacon block root
  const { blockView, blockTree, stateView } = await getBeaconBlock(root);

  const verificationSlot = blockView.slot;

  const strategy = await resolveContract("CompoundingStakingSSVStrategy");

  const { proof: firstPendingDepositSlotProof, slot: firstPendingDepositSlot } =
    await generateFirstPendingDepositSlotProof({
      blockView,
      blockTree,
      stateView,
    });

  const { leaf: balancesContainerRoot, proof: balancesContainerProof } =
    await generateBalancesContainerProof({
      blockView,
      blockTree,
      stateView,
    });

  const verifiedValidators = await strategy.verifiedValidators();

  const validatorBalanceLeaves = [];
  const validatorBalanceProofs = [];
  for (const validator of verifiedValidators) {
    const { proof, leaf, balance } = await generateBalanceProof({
      validatorIndex: validator.index,
      blockView,
      blockTree,
      stateView,
    });
    validatorBalanceLeaves.push(leaf);
    validatorBalanceProofs.push(proof);

    log(
      `Validator ${validator.index} has balance: ${formatUnits(balance)} ETH`
    );
  }

  log(
    `About verify ${verifiedValidators.length} validator balances for slot ${verificationSlot} with beacon block root ${root}`
  );
  const tx = await strategy.connect(signer).verifyBalances({
    blockRoot: root,
    verificationSlot,
    firstPendingDepositSlot,
    firstPendingDepositSlotProof,
    balancesContainerRoot,
    balancesContainerProof,
    validatorBalanceLeaves,
    validatorBalanceProofs,
  });
  await logTxDetails(tx, "verifyBalances");
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
  verifyValidator,
  verifyDeposit,
  verifyBalances,
};
