const { solidityPack, parseUnits } = require("ethers/lib/utils");

const { beaconRoot } = require("./beacon");
const addresses = require("../utils/addresses");
const { replaceContractAt } = require("../utils/hardhat");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:beacon:test:utils");

const calcWithdrawalCredential = (type, owner) => {
  const withdrawalCredential = solidityPack(
    ["bytes1", "bytes11", "address"],
    [type, "0x0000000000000000000000", owner]
  );
  log(`Withdrawal Credentials: ${withdrawalCredential}`);

  return withdrawalCredential;
};

const calcDepositRoot = async (owner, type, pubkey, sig, amount) => {
  // Dynamically import the Lodestar as its an ESM module
  const { ssz } = await import("@lodestar/types");
  const { fromHex } = await import("@lodestar/utils");

  const validTypes = ["0x00", "0x01", "0x02"];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid type ${type}. Must be one of: 0x00, 0x01, 0x02`);
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

async function depositValidator({ pubkey, cred, sig, root, amount, signer }) {
  const depositContract = await hre.ethers.getContractAt(
    "IDepositContract",
    addresses.mainnet.beaconChainDepositContract,
    signer
  );

  const tx = await depositContract.deposit(pubkey, cred, sig, root, {
    value: ethers.utils.parseEther(amount.toString()),
  });
  await logTxDetails(tx, "deposit to validator");
}

async function copyBeaconRoot({ block, signer }) {
  // Get the parent beacon block root from the mainnet BeaconRoots contract
  const { root: parentBlockRoot, timestamp } = await beaconRoot({
    block,
    live: true,
    signer,
  });

  if (parentBlockRoot === "0x") {
    throw new Error(
      `No parent beacon block root found for block ${block} on live chain in the BeaconRoots contract ${addresses.mainnet.beaconRoots}`
    );
  }

  // Now set on the mock contract on the local test network
  const localBeaconRoots = await hre.ethers.getContractAt(
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

  const factory = await hre.ethers.getContractFactory("MockBeaconRoots");
  const mockBeaconRoots = await factory.deploy();

  await replaceContractAt(addresses.mainnet.beaconRoots, mockBeaconRoots);
}

module.exports = {
  calcDepositRoot,
  calcWithdrawalCredential,
  depositValidator,
  copyBeaconRoot,
  mockBeaconRoot,
};
