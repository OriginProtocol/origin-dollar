// viem port of the byte helpers used by the beacon proof engine.
//
// These are faithful, dependency-free copies of:
//   - `toHex` from utils/units.js
//   - `concatProof` from utils/beacon.js
// Neither original uses ethers, so the ported versions are byte-identical.

/**
 * Hex-encodes a byte buffer with a `0x` prefix.
 * Identical to `toHex` in utils/units.js.
 */
export const toHex = (buff: Uint8Array | Buffer | ArrayLike<number>): string => {
  return "0x" + Buffer.from(buff as Uint8Array).toString("hex");
};

/**
 * Flattens the witnesses of a persistent-merkle-tree proof into a single
 * concatenated `Uint8Array` (32 bytes per witness).
 * Identical to `concatProof` in utils/beacon.js.
 */
export const concatProof = (proof: { witnesses: Uint8Array[] }): Uint8Array => {
  const witnessLength = proof.witnesses.length;
  const witnessBytes = new Uint8Array(witnessLength * 32);
  for (let i = 0; i < witnessLength; i++) {
    witnessBytes.set(proof.witnesses[i], i * 32);
  }
  return witnessBytes;
};
