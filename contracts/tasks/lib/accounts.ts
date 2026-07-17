import {
  createTestClient,
  http,
  parseEther,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { makeWalletClient, transportUrlForChain } from "./clients";
import { createKmsAccount } from "./kms-account";
// CJS util.
import { hasAwsKmsCredentials } from "../../utils/signersNoHardhat";

export interface ResolvedSigner {
  /** A viem LocalAccount (KMS / private key) or a plain address (impersonation). */
  account: Account | Address;
  walletClient: WalletClient;
}

/**
 * Resolve a viem signer for a Talos action, mirroring the precedence of the old
 * hardhat `utils/signers.js` minus the Defender relay path:
 *   1. AWS KMS (production)
 *   2. Local private key (DEPLOYER_PK / GOVERNOR_PK)
 *   3. Fork impersonation (FORK=true + IMPERSONATE, dev/testing only)
 * The Postgres nonce queue is applied separately in `sendTx.ts` when
 * DATABASE_URL is set — same gate invariant as before.
 */
export async function resolveSigner(chain: Chain): Promise<ResolvedSigner> {
  if (process.env.USE_DEFENDER_SIGNER === "1") {
    throw new Error(
      "USE_DEFENDER_SIGNER=1 was requested, but the Defender relay signer path " +
        "was removed in the viem migration. Uncheck 'Use Defender Relayer' on " +
        "this action, or run with AWS KMS / a private key."
    );
  }

  // 1. AWS KMS (production runner)
  if (hasAwsKmsCredentials()) {
    const account = await createKmsAccount();
    return { account, walletClient: makeWalletClient(chain, account) };
  }

  // 2. Local private key
  const pk = process.env.DEPLOYER_PK || process.env.GOVERNOR_PK;
  if (pk) {
    const account = privateKeyToAccount(
      (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex
    );
    return { account, walletClient: makeWalletClient(chain, account) };
  }

  // 3. Fork impersonation (dev/testing only — the node signs)
  if (process.env.FORK === "true" && process.env.IMPERSONATE) {
    const address = process.env.IMPERSONATE as Address;
    const testClient = createTestClient({
      chain,
      mode: "anvil",
      transport: http(transportUrlForChain(chain)),
    });
    await testClient.impersonateAccount({ address });
    await testClient.setBalance({ address, value: parseEther("100") });
    return { account: address, walletClient: makeWalletClient(chain, address) };
  }

  throw new Error(
    "No signer available. Set AWS KMS credentials, DEPLOYER_PK/GOVERNOR_PK, or " +
      "FORK=true + IMPERSONATE=0x..."
  );
}
