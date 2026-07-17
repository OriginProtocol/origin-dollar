import { ethers } from "ethers";
import {
  createDb,
  createPool,
  wrapSignerWithNonceQueueV5,
  type Db,
} from "@talos/client";
import { DirectKmsTransactionSigner } from "@lastdotnet/purrikey";
import { getProvider } from "./network";
// CJS util.
import {
  AWS_KMS_REGION,
  hasAwsKmsCredentials,
  resolveKmsRelayerId,
} from "../../utils/signersNoHardhat";

/**
 * Standalone (hardhat-free) signer factory. Same precedence as the old
 * utils/signers.js minus the Defender relay path, and reusing the exact same
 * production-proven building blocks: the purrikey AWS KMS ethers signer and the
 * Talos ethers-v5 nonce queue (wrapSignerWithNonceQueueV5). The only change vs.
 * hardhat is the provider — a standalone JsonRpcProvider from the RPC env
 * instead of hre.ethers.provider.
 */

let dbInstance: Db | null = null;
function getNonceDb(): Db | null {
  if (!process.env.DATABASE_URL) return null;
  if (!dbInstance) {
    dbInstance = createDb(
      createPool({ connectionString: process.env.DATABASE_URL })
    );
  }
  return dbInstance;
}

function maybeWrap(signer: ethers.Signer): ethers.Signer {
  const db = getNonceDb();
  return db
    ? (wrapSignerWithNonceQueueV5(signer, { db }) as unknown as ethers.Signer)
    : signer;
}

export async function getSigner(): Promise<ethers.Signer> {
  const provider = getProvider();

  if (process.env.USE_DEFENDER_SIGNER === "1") {
    throw new Error(
      "USE_DEFENDER_SIGNER=1 was requested, but the Defender relay signer path " +
        "was removed in the hardhat->standalone migration. Uncheck 'Use Defender " +
        "Relayer' on this action, or run with AWS KMS / a private key."
    );
  }

  // 1. AWS KMS (production) — reuse the existing purrikey ethers signer.
  if (hasAwsKmsCredentials()) {
    const relayerId = resolveKmsRelayerId();
    return maybeWrap(
      new DirectKmsTransactionSigner(relayerId, provider, AWS_KMS_REGION)
    );
  }

  // 2. Local private key.
  const pk = process.env.DEPLOYER_PK || process.env.GOVERNOR_PK;
  if (pk) {
    return maybeWrap(new ethers.Wallet(pk, provider));
  }

  // 3. Fork impersonation (dev/testing only — the node signs).
  if (process.env.FORK === "true" && process.env.IMPERSONATE) {
    const address = process.env.IMPERSONATE;
    try {
      await provider.send("anvil_impersonateAccount", [address]);
      await provider.send("anvil_setBalance", [address, "0x56bc75e2d63100000"]); // 100 ETH
    } catch {
      await provider.send("hardhat_impersonateAccount", [address]);
      await provider.send("hardhat_setBalance", [
        address,
        "0x56bc75e2d63100000",
      ]);
    }
    return provider.getSigner(address);
  }

  throw new Error(
    "No signer available. Set AWS KMS credentials, DEPLOYER_PK/GOVERNOR_PK, or " +
      "FORK=true + IMPERSONATE=0x..."
  );
}
