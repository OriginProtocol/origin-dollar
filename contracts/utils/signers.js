const { parseEther } = require("ethers/lib/utils");
const { getDefenderSigner, getKmsSigner } = require("./signersNoHardhat");
const { ethereumAddress } = require("./regex");
const { getProvider } = require("../tasks/lib/network");
const { getSigner: getStandaloneSigner } = require("../tasks/lib/signer");

const log = require("./logger")("utils:signers");

/**
 * Signer factory for the standalone (hardhat-free) action runtime.
 * - If an address is passed, return a JSON-RPC signer for it on the ambient
 *   provider (fork impersonation tooling).
 * - Otherwise delegate to tasks/lib/signer.getSigner(), which selects AWS KMS /
 *   private key / fork impersonation and applies the Postgres nonce queue when
 *   DATABASE_URL is set — the same behavior as before, minus the removed
 *   Defender relay path.
 * @param {string} [address] optional address of the signer
 */
async function getSigner(address = undefined) {
  if (address) {
    if (!address.match(ethereumAddress)) {
      throw Error(`Invalid format of address`);
    }
    return await getProvider().getSigner(address);
  }
  return await getStandaloneSigner();
}

/**
 * Impersonate an account on a forked node (anvil / hardhat node) via raw RPC.
 * @param {string} account address to impersonate
 * @returns an Ethers.js Signer object
 */
async function impersonateAccount(account) {
  log(`Impersonating account ${account}`);
  const provider = getProvider();
  try {
    await provider.send("anvil_impersonateAccount", [account]);
  } catch {
    await provider.send("hardhat_impersonateAccount", [account]);
  }
  return await provider.getSigner(account);
}

/**
 * Impersonate an account and fund it with Ether on a forked node.
 * @param {string} account address to impersonate
 * @param {string|number} amount ETH to fund (converted to wei)
 * @returns an Ethers.js Signer object
 */
async function impersonateAndFund(account, amount = "100") {
  const signer = await impersonateAccount(account);
  log(`Funding account ${account} with ${amount} ETH`);
  const wei = parseEther(amount.toString()).toHexString();
  const provider = getProvider();
  try {
    await provider.send("anvil_setBalance", [account, wei]);
  } catch {
    await provider.send("hardhat_setBalance", [account, wei]);
  }
  return signer;
}

module.exports = {
  getSigner,
  impersonateAccount,
  impersonateAndFund,
  getDefenderSigner,
  getKmsSigner,
};
