// viem port of the validator deposit-data-root computation.
//
// Faithful port of:
//   - `calcDepositRoot` from tasks/beaconTesting.js
//   - `hashPubKey`      from utils/beacon.js
//
// The deposit-data-root itself is SSZ, not ethers: it is computed by
// `ssz.electra.DepositData.hashTreeRoot` from @lodestar/types, with the
// DepositData fields decoded via `fromHex` from @lodestar/utils. Those calls
// are kept byte-identical to the originals. The only ethers usage in the
// originals is the surrounding byte plumbing:
//
//   ethers original              ->  viem equivalent
//   ---------------------------------------------------------------
//   solidityPack(...)            ->  encodePacked(...)
//   parseUnits(amount, 9)        ->  parseUnits(amount, 9)
//   ethers.utils.arrayify(x)     ->  toBytes(x)
//   ethers.utils.hexZeroPad(..)  ->  pad(..., { size, dir: "left" })
//   ethers.utils.concat([...])   ->  concat([...])
//   ethers.utils.sha256(bytes)   ->  sha256(bytes)   (returns 0x-hex)
//
// The return value is the same 0x-prefixed 32-byte hex root as the original.

import { encodePacked, parseUnits, sha256, toBytes, pad, concat } from "viem";

const log = require("../../../utils/logger")("task:beacon:test:utils");

// Deposit types accepted by the original calcDepositRoot.
const VALID_TYPES = ["0x00", "0x01", "0x02"];

/**
 * Computes the SSZ hash tree root of a validator DepositData.
 *
 * Byte-identical port of `calcDepositRoot` in tasks/beaconTesting.js.
 *
 * @param owner   0x-prefixed 20-byte address embedded in the withdrawal credential
 * @param type    withdrawal credential prefix byte, one of "0x00" | "0x01" | "0x02"
 * @param pubkey  0x-prefixed 48-byte validator public key
 * @param sig     0x-prefixed 96-byte BLS signature
 * @param amount  deposit amount in ETH units (e.g. 32 or 2048)
 * @returns 0x-prefixed 32-byte hex deposit data root
 */
export const calcDepositRoot = async (
  owner: string,
  type: string,
  pubkey: string,
  sig: string,
  amount: string | number
): Promise<string> => {
  // Dynamically import Lodestar as it is an ESM module.
  const { ssz } = await import("@lodestar/types");
  const { fromHex } = await import("@lodestar/utils");

  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid type ${type}. Must be one of: 0x00, 0x01, 0x02`);
  }

  const withdrawalCredential = encodePacked(
    ["bytes1", "bytes11", "address"],
    [
      type as `0x${string}`,
      "0x0000000000000000000000" as `0x${string}`,
      owner as `0x${string}`,
    ]
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

/**
 * Hashes a validator public key by right-padding it with 16 zero bytes and
 * taking the SHA256 digest.
 *
 * Byte-identical port of `hashPubKey` in utils/beacon.js.
 *
 * @param pubKey 0x-prefixed hex public key (or byte array)
 * @returns 0x-prefixed 32-byte SHA256 hash
 */
export const hashPubKey = (pubKey: string | Uint8Array): string => {
  // Ensure pubKey is bytes.
  const pubKeyBytes = toBytes(pubKey);

  // Create 16 bytes of zeros (ethers hexZeroPad("0x0", 16)).
  const zeroBytes = pad(new Uint8Array(0), { size: 16, dir: "left" });

  // Concatenate pubKey and zero bytes.
  const concatenated = concat([pubKeyBytes, zeroBytes]);

  // Compute SHA256 hash (viem sha256 returns a 0x-prefixed hex string).
  return sha256(concatenated);
};
