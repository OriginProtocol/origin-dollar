const { Wallet } = require("ethers").utils;
const { Defender } = require("@openzeppelin/defender-sdk");

const { ethereumAddress, privateKey } = require("./regex");
const { hardhatSetBalance } = require("../test/_fund");
const hhHelpers = require("@nomicfoundation/hardhat-network-helpers");

const log = require("./logger")("utils:signers");

/**
 * Signer factory that gets a signer for a hardhat test or task
 * If address is passed, use that address as signer.
 * If DEPLOYER_PK or GOVERNOR_PK is set, use that private key as signer.
 * If a fork and IMPERSONATE is set, impersonate that account.
 * else get the first signer from the hardhat node.
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
  const pk = process.env.DEPLOYER_PK || process.env.GOVERNOR_PK;
  if (pk) {
    if (!pk.match(privateKey)) {
      throw Error(`Invalid format of private key`);
    }
    const wallet = new Wallet(pk, hre.ethers.provider);
    log(`Using signer ${await wallet.getAddress()} from private key`);
    return wallet;
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

  // If using Defender Relayer
  if (process.env.DEFENDER_API_KEY && process.env.DEFENDER_API_SECRET) {
    return await getDefenderSigner();
  }

  const signers = await hre.ethers.getSigners();
  const signer = signers[0];
  log(`Using signer ${await signer.getAddress()}`);

  return signer;
}

const getDefenderSigner = async () => {
  const speed = process.env.SPEED || "fast";
  if (!["safeLow", "average", "fast", "fastest"].includes(speed)) {
    console.error(
      `Defender Relay Speed param must be either 'safeLow', 'average', 'fast' or 'fastest'. Not "${speed}"`
    );
    process.exit(2);
  }
  const credentials = {
    relayerApiKey: process.env.DEFENDER_API_KEY,
    relayerApiSecret: process.env.DEFENDER_API_SECRET,
  };
  const client = new Defender(credentials);
  const provider = client.relaySigner.getProvider();

  const signer = client.relaySigner.getSigner(provider, { speed });
  log(
    `Using Defender Relayer account ${await signer.getAddress()} from env vars DEFENDER_API_KEY and DEFENDER_API_SECRET`
  );
  return signer;
};

/**
 * Impersonate an account when connecting to a forked node.
 * @param {*} account the address of the contract or externally owned account to impersonate
 * @returns an Ethers.js Signer object
 */
async function impersonateAccount(account) {
  log(`Impersonating account ${account}`);

  await hhHelpers.impersonateAccount(account);

  return await ethers.provider.getSigner(account);
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
  await hardhatSetBalance(account, amount);

  return signer;
}

module.exports = {
  getSigner,
  impersonateAccount,
  impersonateAndFund,
};
