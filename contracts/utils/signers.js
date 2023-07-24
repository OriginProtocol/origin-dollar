const { parseEther } = require("ethers").utils;

const log = require("./logger")("utils:signers");

/**
 * Impersonate an account when connecting to a forked node.
 * @param {*} account the address of the contract or externally owned account to impersonate
 * @returns an Ethers.js Signer object
 */
async function impersonateAccount(account) {
  log(`Impersonating account ${account}`);

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [account],
  });

  return await ethers.provider.getSigner(account);
}

async function _hardhatSetBalance(address, amount = "10000") {
  await hre.network.provider.request({
    method: "hardhat_setBalance",
    params: [
      address,
      parseEther(amount)
        .toHexString()
        .replace(/^0x0+/, "0x")
        .replace(/0$/, "1"),
    ],
  });
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
  await _hardhatSetBalance(account, amount);

  return signer;
}

module.exports = {
  impersonateAccount,
  impersonateAndFund,
};
