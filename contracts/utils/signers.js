const { Wallet } = require("ethers");
const { parseEther } = require("ethers/lib/utils");
const hhHelpers = require("@nomicfoundation/hardhat-network-helpers");
const {
  wrapSignerWithNonceQueueV5,
  createDb,
  createPool,
} = require("@talos/client");
const {
  getKmsAddress,
  getKmsSigner,
  hasAwsKmsCredentials,
} = require("./signersNoHardhat");
const { ethereumAddress, privateKey } = require("./regex");

const log = require("./logger")("utils:signers");

let dbInstance = null;
function getNonceDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!dbInstance) {
    const pool = createPool({ connectionString: process.env.DATABASE_URL });
    dbInstance = createDb(pool);
  }
  return dbInstance;
}

// Wrap a raw signer with the nonce-queue Proxy when DATABASE_URL is set.
// Returning the raw signer unchanged in dev / fork flows preserves the
// DATABASE_URL gate invariant: no queue engagement without explicit opt-in.
function maybeWrap(rawSigner) {
  const db = getNonceDb();
  if (!db) return rawSigner;
  return wrapSignerWithNonceQueueV5(rawSigner, { db });
}

/**
 * Signer factory that gets a signer for a hardhat test or task
 * If address is passed, use that address as signer.
 * If AWS IAM KMS credentials are set, use a KMS-backed signer.
 * If DEPLOYER_PK or GOVERNOR_PK is set, use that private key as signer.
 * If a fork and IMPERSONATE is set, impersonate that account.
 * else get the first signer from the hardhat node.
 *
 * Returned signer is wrapped with `wrapSignerWithNonceQueueV5` when
 * DATABASE_URL is set so every sendTransaction routes through the
 * shared Postgres nonce queue / lifecycle recording. The `address`
 * branch (an explicit impersonation for tooling) is not wrapped.
 * @param {*} address optional address of the signer
 * @returns
 */
async function getSigner(address = undefined) {
  if (address) {
    if (!address.match(ethereumAddress)) {
      throw Error(`Invalid format of address`);
    }
    return await hre.ethers.provider.getSigner(address);
  }

  if (hasAwsKmsCredentials()) {
    const address = await getKmsAddress({ provider: hre.ethers.provider });
    log(`Using KMS signer ${address}`);
    return maybeWrap(await getKmsSigner(hre));
  }

  const pk = process.env.DEPLOYER_PK || process.env.GOVERNOR_PK;
  if (pk) {
    if (!pk.match(privateKey)) {
      throw Error(`Invalid format of private key`);
    }
    const wallet = new Wallet(pk, hre.ethers.provider);
    log(`Using signer ${await wallet.getAddress()} from private key`);
    return maybeWrap(wallet);
  }

  if (process.env.FORK === "true" && process.env.IMPERSONATE) {
    let address = process.env.IMPERSONATE;
    if (!address.match(ethereumAddress)) {
      throw Error(
        `Environment variable IMPERSONATE is an invalid Ethereum address or contract name`
      );
    }
    log(
      `Impersonating account ${address} from IMPERSONATE environment variable`
    );
    return await impersonateAndFund(address);
  }

  const signers = await hre.ethers.getSigners();
  const signer = signers[0];
  log(`Using first hardhat signer ${await signer.getAddress()}`);

  return signer;
}

/**
 * Impersonate an account when connecting to a forked node.
 * @param {*} account the address of the contract or externally owned account to impersonate
 * @returns an Ethers.js Signer object
 */
async function impersonateAccount(account) {
  log(`Impersonating account ${account}`);

  await hhHelpers.impersonateAccount(account);

  return await hre.ethers.provider.getSigner(account);
}

/**
 * Impersonate an account and fund it with Ether when connecting to a forked node.
 * @param {*} account the address of the contract or externally owned account to impersonate
 * @amount the amount of Ether to fund the account with. This will be converted to wei.
 * @returns an Ethers.js Signer object
 */
async function impersonateAndFund(account, amount = "100") {
  const signer = await impersonateAccount(account);

  log(`Funding account ${account} with ${amount} ETH`);
  await hhHelpers.setBalance(account, parseEther(amount.toString()));

  return signer;
}

module.exports = {
  getSigner,
  impersonateAccount,
  impersonateAndFund,
  getKmsSigner,
};
