import { KMSClient, SignCommand } from "@aws-sdk/client-kms";
// purrikey's DER→signature recovery: given the DER sig + digest + expected
// address, it low-s normalises and picks the correct recovery param. Reused
// verbatim (it is ethers-agnostic byte math) so KMS signing stays battle-tested.
import { derToSignature } from "@lastdotnet/purrikey";
import { toAccount } from "viem/accounts";
import {
  hashMessage,
  hashTypedData,
  hexToBytes,
  keccak256,
  serializeSignature,
  serializeTransaction,
  type Account,
  type Hex,
} from "viem";
// CJS util; esModuleInterop provides these named bindings from module.exports.
import {
  AWS_KMS_REGION,
  getKmsAddress,
  resolveKmsRelayerId,
} from "../../utils/signersNoHardhat";

async function kmsSignDigest(
  kms: KMSClient,
  keyId: string,
  digest: Hex,
  expectedAddr: string,
  chainId: number
): Promise<{ r: Hex; s: Hex; yParity: number }> {
  const res = await kms.send(
    new SignCommand({
      KeyId: keyId,
      Message: hexToBytes(digest),
      MessageType: "DIGEST",
      SigningAlgorithm: "ECDSA_SHA_256",
    })
  );
  if (!res.Signature) {
    throw new Error(`KMS returned no signature for key ${keyId}`);
  }
  const sig = await derToSignature(
    Buffer.from(res.Signature),
    digest,
    chainId,
    expectedAddr
  );
  // ethers Signature: recoveryParam is 0/1 == viem yParity; r/s are 0x 32-byte.
  return { r: sig.r as Hex, s: sig.s as Hex, yParity: sig.recoveryParam };
}

/**
 * Build a viem `Account` backed by an AWS KMS key. The account signs
 * transactions, messages and typed data by asking KMS to sign the keccak
 * digest, then recovering r/s/yParity via purrikey. Key selection mirrors the
 * hardhat signer (`KMS_RELAYER_ID` env / per-task overrides / prod default).
 */
export async function createKmsAccount(relayerId?: string): Promise<Account> {
  const keyId = resolveKmsRelayerId({ relayerId });
  const address = (await getKmsAddress({ relayerId: keyId })) as Hex;
  const kms = new KMSClient({ region: process.env.REGION || AWS_KMS_REGION });

  return toAccount({
    address,
    async signMessage({ message }) {
      const { r, s, yParity } = await kmsSignDigest(
        kms,
        keyId,
        hashMessage(message),
        address,
        1
      );
      return serializeSignature({ r, s, yParity });
    },
    async signTypedData(typedData) {
      const { r, s, yParity } = await kmsSignDigest(
        kms,
        keyId,
        hashTypedData(typedData as never),
        address,
        1
      );
      return serializeSignature({ r, s, yParity });
    },
    async signTransaction(transaction) {
      // All target chains use the standard EVM tx serializer (no custom
      // serializer needed), so compute the digest and the signed tx with it.
      const unsigned = serializeTransaction(transaction);
      const chainId =
        typeof transaction.chainId === "number" ? transaction.chainId : 1;
      const { r, s, yParity } = await kmsSignDigest(
        kms,
        keyId,
        keccak256(unsigned),
        address,
        chainId
      );
      return serializeTransaction(transaction, { r, s, yParity });
    },
  });
}
