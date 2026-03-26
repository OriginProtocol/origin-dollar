import { GetPublicKeyCommand, KMSClient, SignCommand } from "@aws-sdk/client-kms";
import { DirectKmsTransactionSigner } from "@lastdotnet/purrikey";
import { ethers } from "ethers";
import {
  type Hex,
  hashMessage,
  hashTypedData,
  hexToBytes,
  keccak256,
  type LocalAccount,
  recoverAddress,
  serializeTransaction,
  signatureToHex,
  type TransactionSerializable,
  type TypedDataDefinition,
} from "viem";
import { toAccount } from "viem/accounts";
import { optionalEnv } from "./env";

const DEFAULT_KMS_RELAYER_ID = "mrk-248128595151466bb7f7b9a56501a98f";
const AWS_KMS_REGION = "us-east-1";

// secp256k1 curve order
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

function getKmsKeyId(): string {
  return optionalEnv("KMS_RELAYER_ID") ?? DEFAULT_KMS_RELAYER_ID;
}

/**
 * Decode a DER-encoded ECDSA signature into (r, s) as bigints.
 */
function decodeDerSignature(der: Uint8Array): { r: bigint; s: bigint } {
  let pos = 0;

  if (der[pos++] !== 0x30) throw new Error("Invalid DER: expected SEQUENCE (0x30)");
  pos++; // skip sequence length

  if (der[pos++] !== 0x02) throw new Error("Invalid DER: expected INTEGER (0x02) for r");
  const rLen = der[pos++];
  let rBytes = der.slice(pos, pos + rLen);
  pos += rLen;

  if (der[pos++] !== 0x02) throw new Error("Invalid DER: expected INTEGER (0x02) for s");
  const sLen = der[pos++];
  let sBytes = der.slice(pos, pos + sLen);

  // Strip leading zero padding (DER uses it to avoid negative interpretation)
  while (rBytes.length > 1 && rBytes[0] === 0x00) rBytes = rBytes.slice(1);
  while (sBytes.length > 1 && sBytes[0] === 0x00) sBytes = sBytes.slice(1);

  const r = BigInt(`0x${Buffer.from(rBytes).toString("hex")}`);
  const s = BigInt(`0x${Buffer.from(sBytes).toString("hex")}`);

  return { r, s };
}

/**
 * Extract the uncompressed secp256k1 public key from a DER-encoded
 * SubjectPublicKeyInfo blob (as returned by KMS GetPublicKey).
 * Returns the 65-byte uncompressed key (04 ‖ x ‖ y).
 */
function extractPublicKeyFromDer(der: Uint8Array): Uint8Array {
  // AWS KMS returns a SubjectPublicKeyInfo structure. The last 65 bytes
  // are the uncompressed EC point (0x04 prefix + 32-byte x + 32-byte y).
  if (der.length < 65) {
    throw new Error(`DER public key too short: ${der.length} bytes`);
  }
  const pubKey = der.slice(-65);
  if (pubKey[0] !== 0x04) {
    throw new Error(
      `Expected uncompressed public key prefix 0x04, got 0x${pubKey[0].toString(16)}`,
    );
  }
  return pubKey;
}

/**
 * Derive an Ethereum address from an uncompressed secp256k1 public key.
 * address = last 20 bytes of keccak256(x ‖ y)
 */
function publicKeyToAddress(uncompressedKey: Uint8Array): `0x${string}` {
  // Strip the 0x04 prefix — keccak256 the raw 64-byte (x, y)
  const xy = uncompressedKey.slice(1);
  const xyHex = `0x${Buffer.from(xy).toString("hex")}` as Hex;
  const hash = keccak256(xyHex);
  // Last 20 bytes of the hash
  return `0x${hash.slice(-40)}` as `0x${string}`;
}

/**
 * Resolve the Ethereum address for a KMS key via GetPublicKey.
 */
async function resolveKmsAddress(kmsClient: KMSClient, keyId: string): Promise<`0x${string}`> {
  const response = await kmsClient.send(new GetPublicKeyCommand({ KeyId: keyId }));
  if (!response.PublicKey) {
    throw new Error("No public key returned from KMS");
  }
  const pubKey = extractPublicKeyFromDer(new Uint8Array(response.PublicKey));
  return publicKeyToAddress(pubKey);
}

function bigintToHex32(value: bigint): Hex {
  return `0x${value.toString(16).padStart(64, "0")}` as Hex;
}

/**
 * Sign a 32-byte digest with AWS KMS and return {r, s, yParity}.
 * Handles low-s canonicalization (EIP-2) and recovery parity detection.
 */
async function kmsSign(
  kmsClient: KMSClient,
  keyId: string,
  digest: Hex,
  expectedAddress: `0x${string}`,
): Promise<{ r: Hex; s: Hex; yParity: 0 | 1 }> {
  const response = await kmsClient.send(
    new SignCommand({
      KeyId: keyId,
      Message: Buffer.from(hexToBytes(digest)),
      MessageType: "DIGEST",
      SigningAlgorithm: "ECDSA_SHA_256",
    }),
  );

  if (!response.Signature) {
    throw new Error("No signature returned from KMS");
  }

  let { r, s } = decodeDerSignature(new Uint8Array(response.Signature));

  // EIP-2: canonicalize s to lower half of curve order
  if (s > SECP256K1_N / 2n) {
    s = SECP256K1_N - s;
  }

  const rHex = bigintToHex32(r);
  const sHex = bigintToHex32(s);

  // Try all recovery parities to find the one matching our address
  for (const yParity of [0, 1] as const) {
    const recovered = await recoverAddress({
      hash: digest,
      signature: { r: rHex, s: sHex, v: BigInt(yParity + 27) },
    });

    if (recovered.toLowerCase() === expectedAddress.toLowerCase()) {
      return { r: rHex, s: sHex, yParity };
    }
  }

  throw new Error(`KMS signature recovery failed: could not recover ${expectedAddress}`);
}

/**
 * Create a viem LocalAccount backed by AWS KMS.
 * Chain-agnostic — chain context comes from the walletClient, not the account.
 * Address is resolved once via GetPublicKey and cached in the closure.
 */
export async function getKmsAccount(): Promise<LocalAccount> {
  const keyId = getKmsKeyId();
  const kmsClient = new KMSClient({ region: AWS_KMS_REGION });
  const address = await resolveKmsAddress(kmsClient, keyId);

  return toAccount({
    address,

    async signMessage({ message }) {
      const digest = hashMessage(message);
      const sig = await kmsSign(kmsClient, keyId, digest, address);
      return signatureToHex({
        r: sig.r,
        s: sig.s,
        yParity: sig.yParity,
      });
    },

    async signTransaction(tx) {
      const serialized = serializeTransaction(tx as TransactionSerializable);
      const digest = keccak256(serialized);
      const sig = await kmsSign(kmsClient, keyId, digest, address);
      return serializeTransaction(tx as TransactionSerializable, {
        r: sig.r,
        s: sig.s,
        yParity: sig.yParity,
      });
    },

    async signTypedData(typedData) {
      const digest = hashTypedData(typedData as TypedDataDefinition);
      const sig = await kmsSign(kmsClient, keyId, digest, address);
      return signatureToHex({
        r: sig.r,
        s: sig.s,
        yParity: sig.yParity,
      });
    },
  }) as LocalAccount;
}

/**
 * Create an ethers v5 Signer backed by AWS KMS.
 * Used for contracts/ utility functions that expect ethers.Signer.
 */
export function getEthersSigner(
  provider: ethers.providers.JsonRpcProvider,
): DirectKmsTransactionSigner {
  const keyId = getKmsKeyId();
  return new DirectKmsTransactionSigner(keyId, provider, AWS_KMS_REGION);
}

/**
 * Create an ethers v5 JsonRpcProvider from an RPC URL.
 */
export function getEthersProvider(rpcUrl: string): ethers.providers.JsonRpcProvider {
  return new ethers.providers.JsonRpcProvider(rpcUrl);
}
