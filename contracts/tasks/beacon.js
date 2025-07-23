const { Wallet } = require("ethers");
const {
  defaultAbiCoder,
  formatUnits,
  solidityPack,
  parseUnits,
  arrayify,
} = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const { getBeaconBlock, getSlot } = require("../utils/beacon");
const { replaceContractAt } = require("../utils/hardhat");
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
const { toHex } = require("../utils/units");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:beacon");

function getProvider() {
  // Get provider to Ethereum mainnet and not a local fork
  return new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
}

const calcDepositRoot = async (owner, type, pubkey, sig, amount) => {
  // Dynamically import the Lodestar as its an ESM module
  const { ssz } = await import("@lodestar/types");
  const { fromHex } = await import("@lodestar/utils");

  const validTypes = ["0x00", "0x01", "0x02"];
  if (!validTypes.includes(type)) {
    throw new Error("type must be one of: 0x00, 0x01, 0x02");
  }

  const withdrawalCredential = solidityPack(
    ["bytes1", "bytes11", "address"],
    [type, "0x0000000000000000000000", owner]
  );
  log(`Withdrawal Credentials: ${withdrawalCredential}`);

  // amount in Gwei
  const amountGwei = parseUnits(amount.toString(), 9);

  // Define the DepositData object
  const depositData = {
    pubkey: fromHex(pubkey), // 48-byte public key
    withdrawalCredentials: fromHex(withdrawalCredential), // 32-byte withdrawal credentials
    amount: amountGwei.toString(),
    signature: fromHex(sig), // 96-byte signature
  };

  // Compute the SSZ hash tree root
  const depositDataRoot = ssz.electra.DepositData.hashTreeRoot(depositData);

  // Return as a hex string with 0x prefix
  const depositDataRootHex =
    "0x" + Buffer.from(depositDataRoot).toString("hex");

  log(`Deposit Root Data: ${depositDataRootHex}`);

  return depositDataRootHex;
};

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

async function verifySlot({ block, dryrun }) {
  const signer = await getSigner();

  // Get provider to mainnet and not a local fork
  const providerMainnet = getProvider();
  const signerMainnet = new Wallet.createRandom().connect(providerMainnet);

  // Get the timestamp of the next block
  const nextBlock = block + 1;
  const { timestamp: nextBlockTimestamp } = await providerMainnet.getBlock(
    nextBlock
  );
  log(`Next mainnet block ${nextBlock} has timestamp ${nextBlockTimestamp}`);

  // Get the parent block root from the beacon roots contract from mainnet
  const mainnetBeaconRoots = await ethers.getContractAt(
    "MockBeaconRoots",
    // Need to use mainnet address and not local deployed address
    addresses.mainnet.mockBeaconRoots,
    signerMainnet
  );
  log(
    `Using mainnet MockBeaconRoots contract at ${mainnetBeaconRoots.address}`
  );
  const blockRoot = await mainnetBeaconRoots.parentBlockRoot(
    nextBlockTimestamp
  );
  log(`Beacon block root for block ${block} is ${blockRoot}`);

  const slot = await getSlot(blockRoot);
  log(`Slot for block ${block} is:`, slot);

  const { blockView, blockTree } = await getBeaconBlock(slot);

  const { proof: slotProofBytes, root: beaconBlockRoot } =
    await generateSlotProof({
      blockView,
      blockTree,
    });

  const { proof: blockNumberProofBytes } = await generateBlockProof({
    blockView,
    blockTree,
  });

  const oracle = await resolveContract("BeaconOracle");

  if (dryrun) {
    console.log(`beaconBlockRoot: ${beaconBlockRoot}`);
    console.log(`nextBlockTimestamp: ${nextBlockTimestamp}`);
    console.log(`block: ${block}`);
    console.log(`slot: ${slot}`);
    console.log(`slotProofBytes: ${slotProofBytes}`);
    console.log(`blockNumberProofBytes: ${blockNumberProofBytes}`);
    return;
  }

  log(
    `About to verify block ${block} and slot ${slot} to beacon chain root ${beaconBlockRoot}`
  );
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

async function verifyValidator({ slot, index, dryrun, withdrawal }) {
  const signer = await getSigner();

  const { blockView, blockTree, stateView } = await getBeaconBlock(slot);

  if (withdrawal) {
    log(`Overriding withdrawal address to ${withdrawal}`);

    // Update the validator's withdrawalCredentials in stateView
    const validator = stateView.validators.get(index);
    if (
      !validator ||
      toHex(validator.node.root) ==
        "0x0000000000000000000000000000000000000000000000000000000000000000"
    ) {
      throw new Error(`Validator at index ${index} not found for slot ${slot}`);
    }

    log(
      `Original withdrawal credentials: ${toHex(
        validator.withdrawalCredentials
      )}`
    );

    // Override the address in the withdrawal credentials
    validator.withdrawalCredentials = arrayify(
      `0x020000000000000000000000${withdrawal.slice(2)}`
    );
    stateView.validators.set(index, validator); // Update validator in state

    // Update blockTree with new stateRoot
    const stateRootGindex = blockView.type.getPathInfo(["stateRoot"]).gindex;
    blockTree.setNode(stateRootGindex, stateView.node);
  }

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
    root: beaconBlockRoot,
    pubKey,
  } = await generateValidatorPubKeyProof({
    validatorIndex: index,
    blockView,
    blockTree,
    stateView,
  });

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  if (dryrun) {
    console.log(`beaconBlockRoot: ${beaconBlockRoot}`);
    console.log(`nextBlockTimestamp: ${nextBlockTimestamp}`);
    console.log(`validator index: ${index}`);
    console.log(`pubKeyHash: ${pubKeyHash}`);
    console.log(`proof: ${proof}`);
    return;
  }

  log(
    `About verify validator ${index} with pub key ${pubKey}, pub key hash ${pubKeyHash} at slot ${blockView.slot} to beacon chain root ${beaconBlockRoot}`
  );
  const tx = await strategy
    .connect(signer)
    .verifyValidator(nextBlockTimestamp, index, pubKeyHash, proof);
  await logTxDetails(tx, "verifyValidator");
}

async function verifyDeposit({ block, slot, root: depositDataRoot, dryrun }) {
  const signer = await getSigner();

  // TODO If no block then get the block from the stakeETH event
  // For now we'll throw an error
  if (!block) throw Error("Block is currently required for verifyDeposit");

  if (!dryrun) {
    // Check the deposit block has been mapped in the Beacon Oracle
    const oracle = await resolveContract("BeaconOracle");
    const isMapped = await oracle.isBlockMapped(block);
    if (!isMapped) {
      log(`Block ${block} is not mapped in the Beacon Oracle`);
      await verifySlot({ block });
    }
  }

  // Uses the latest slot if the slot is undefined
  const { blockView, blockTree, stateView } = await getBeaconBlock(slot);

  const processedSlot = blockView.slot;

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  const {
    proof,
    slot: firstPendingDepositSlot,
    root: beaconBlockRoot,
  } = await generateFirstPendingDepositSlotProof({
    blockView,
    blockTree,
    stateView,
  });

  if (dryrun) {
    console.log(`depositDataRoot: ${depositDataRoot}`);
    console.log(`beaconBlockRoot: ${beaconBlockRoot}`);
    console.log(`block: ${block}`);
    console.log(`processedSlot: ${processedSlot}`);
    console.log(`firstPendingDepositSlot: ${firstPendingDepositSlot}`);
    console.log(`proof: ${proof}`);
    return;
  }

  log(
    `About to verify deposit for deposit block ${block}, processing slot ${processedSlot}, deposit data root ${depositDataRoot}, slot of first pending deposit ${firstPendingDepositSlot} to beacon chain root ${beaconBlockRoot}`
  );
  const tx = await strategy
    .connect(signer)
    .verifyDeposit(
      depositDataRoot,
      block,
      processedSlot,
      firstPendingDepositSlot,
      proof
    );
  await logTxDetails(tx, "verifyDeposit");
}

async function verifyBalances({ root, indexes, dryrun }) {
  const signer = await getSigner();

  if (!root) {
    if (!dryrun) {
      // TODO If no beacon block root, then get from the blockRoot from the last BalancesSnapped event
      // Revert for now
      throw Error("Beacon block root is currently required for verifyBalances");
    }

    root = "head";
  }

  // Uses the beacon chain data for the beacon block root
  const { blockView, blockTree, stateView } = await getBeaconBlock(root);

  const beaconBlockRoot = toHex(blockView.hashTreeRoot());
  const verificationSlot = blockView.slot;

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

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

  const verifiedValidators = indexes
    ? indexes.split(",").map((index) => ({
        index,
      }))
    : await strategy.getVerifiedValidators();

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
      `Validator ${validator.index} has balance: ${formatUnits(balance, 9)} ETH`
    );
  }

  if (dryrun) {
    console.log(`beaconBlockRoot: ${beaconBlockRoot}`);
    console.log(`verificationSlot: ${verificationSlot}`);
    console.log(`firstPendingDepositSlot: ${firstPendingDepositSlot}`);
    console.log(
      `firstPendingDepositSlotProof: ${firstPendingDepositSlotProof}`
    );
    console.log(`balancesContainerRoot: ${balancesContainerRoot}`);
    console.log(`balancesContainerProof: ${balancesContainerProof}`);
    console.log(`validatorBalanceLeaves: ${validatorBalanceLeaves}`);
    console.log(`validatorBalanceProofs: ${validatorBalanceProofs}`);
    return;
  }

  log(
    `About verify ${verifiedValidators.length} validator balances for slot ${verificationSlot} to beacon block root ${beaconBlockRoot}`
  );
  const tx = await strategy.connect(signer).verifyBalances({
    blockRoot: beaconBlockRoot,
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

async function slotToRoot({ slot }) {
  const oracle = await resolveContract("BeaconOracle");

  const root = await oracle.slotToRoot(slot);

  console.log(`Slot ${slot} maps to beacon block root ${root}`);

  return root;
}

async function beaconRoot({ block, mainnet }) {
  // Either use mainnet or local fork to get the block timestamp
  const provider = mainnet ? getProvider() : ethers.provider;

  // Get timestamp of the block
  const fetchedBlock = await provider.getBlock(block);
  if (fetchedBlock == null) throw Error(`Block ${block} not found`);

  const { timestamp } = fetchedBlock;
  log(`Block ${block} has timestamp ${timestamp}`);

  const data = defaultAbiCoder.encode(["uint256"], [timestamp]);
  log(`Encoded timestamp data: ${data}`);

  const root = await provider.call(
    {
      to: addresses.mainnet.beaconRoots,
      data,
    },
    block + 1 // blockTag
  );

  console.log(`Block ${block} has parent beacon block root ${root}`);

  return { root, timestamp };
}

async function copyBeaconRoot({ block }) {
  // Get the parent beacon block root from the mainnet BeaconRoots contract
  const { root: parentBlockRoot, timestamp } = await beaconRoot({
    block,
    mainnet: true,
  });

  if (parentBlockRoot === "0x") {
    throw new Error(
      `No parent beacon block root found for block ${block} on mainnet in the BeaconRoots contract ${addresses.mainnet.beaconRoots}`
    );
  }

  // Now set on the mock contract on the local test network
  const localBeaconRoots = await ethers.getContractAt(
    "MockBeaconRoots",
    addresses.mainnet.beaconRoots
  );
  log(
    `About to set parent beacon block root ${parentBlockRoot} for timestamp ${timestamp} on local BeaconRoots contract at ${localBeaconRoots.address}`
  );
  await localBeaconRoots["setBeaconRoot(uint256,bytes32)"](
    timestamp,
    parentBlockRoot
  );

  return parentBlockRoot;
}

async function mockBeaconRoot() {
  if (hre.network.name == "mainnet") {
    throw new Error(
      "This task can only be run against a hardhat or a local forked network"
    );
  }

  const factory = await ethers.getContractFactory("MockBeaconRoots");
  const mockBeaconRoots = await factory.deploy();

  await replaceContractAt(addresses.mainnet.beaconRoots, mockBeaconRoots);
}

module.exports = {
  calcDepositRoot,
  depositValidator,
  verifySlot,
  blockToSlot,
  slotToBlock,
  slotToRoot,
  beaconRoot,
  copyBeaconRoot,
  mockBeaconRoot,
  verifyValidator,
  verifyDeposit,
  verifyBalances,
};
