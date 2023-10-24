const {
  setBalance,
  setStorageAt,
  getStorageAt,
} = require("@nomicfoundation/hardhat-network-helpers");
const ethrs = require("ethers");
const addresses = require("../utils/addresses");
const {
  parseEther,
  defaultAbiCoder,
  keccak256,
  hexlify,
  zeroPad,
  solidityKeccak256,
} = ethrs.utils;
const { units } = require("../utils/units");
const erc20Abi = require("./abi/erc20.json");

const mappedFundingSlots = {};
const balancesContractSlotCache = {};
/**
 *
 * Based on https://blog.euler.finance/brute-force-storage-layout-discovery-in-erc20-contracts-with-hardhat-7ff9342143ed
 * @export
 * @param {string} tokenAddress
 * @return {*}  {Promise<number>}
 */
const findBalancesSlot = async (tokenAddress) => {
  // need to check for undefined since a "0" is a valid value that defaults to false 
  // in the if statement
  if (balancesContractSlotCache[tokenAddress] !== undefined) {
    return balancesContractSlotCache[tokenAddress];
  }

  const { ethers } = (await import("hardhat")).default;

  const encode = (types, values) => defaultAbiCoder.encode(types, values);

  const account = ethrs.constants.AddressZero;
  const probeA = encode(["uint"], [1]);
  const probeB = encode(["uint"], [2]);

  const token = await ethers.getContractAt(erc20Abi, tokenAddress);

  for (let i = 0; i < 100; i += 1) {
    const probedSlot = keccak256(encode(["address", "uint"], [account, i]));
    if (probedSlot.startsWith("0x0")) continue;
    // remove padding for JSON RPC
    // while (probedSlot.startsWith("0x0")) {
    //     probedSlot = `0x${probedSlot.slice(3)}`
    // }

    const prev = await getStorageAt(tokenAddress, probedSlot, "latest");

    // make sure the probe will change the slot value
    const probe = prev === probeA ? probeB : probeA;

    await setStorageAt(tokenAddress, probedSlot, probe);

    const balance = await token.balanceOf(account);

    // reset to previous value
    await setStorageAt(tokenAddress, probedSlot, prev);

    if (balance.eq(ethrs.BigNumber.from(probe))) {
      balancesContractSlotCache[tokenAddress] = i;
      return i;
    }
  }
  throw new Error("Balances slot not found!");
};

const toBytes32 = (bn) => hexlify(zeroPad(bn.toHexString(), 32));

/**
 * Set the Balance of a user under an ERC20 token
 *
 * @param {string} userAddress
 * @param {object} tokenContract
 * @param {BN} amount
 * @param {string} [slotIndex]
 * @return {*}  {Promise<void>}
 */
const setTokenBalance = async (
  userAddress,
  tokenContract,
  amount,
  slotIndex = undefined,
  hre
) => {
  const amountBn = await units(amount, tokenContract);
  let index = slotIndex;
  if (slotIndex === undefined) {
    const balanceSlot = await findBalancesSlot(tokenContract.address);
    // key, slot
    index = solidityKeccak256(
      ["uint256", "uint256"],
      [userAddress, balanceSlot]
    );

    if (!mappedFundingSlots[tokenContract.address])
      mappedFundingSlots[tokenContract.address] = {};

    mappedFundingSlots[tokenContract.address][userAddress] = index;
  }

  console.log(
    `Setting balance of user ${userAddress} with token ${tokenContract.address}`
  );
  await setStorageAt(
    tokenContract.address,
    toBytes32(ethrs.BigNumber.from(index)),
    toBytes32(amountBn).toString()
  );
};

/**
 * Sets ETH balance of an account
 *
 * @param {Account} account to set balance
 * @param {number} [amount=10000] Amount of ETH to set
 */
async function hardhatSetBalance(address, hre, amount = "10000") {
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
 * Sets balance to a given account
 *
 * @param {Account} account to set balance
 * @param {[ERC20]} tokensTransfer Tokens that sets the balance by token.transfer tx
 * @param {number} [amount=10000] Amount of tokens to set
 */
const setERC20TokenBalance = async (account, token, amount = "10000", hre) => {
  /* Format:
   * config = {
   *   tokenContract.address1: {
   *     userAddress1: slotIndex1,
   *     userAddress2: slotIndex2
   *   }
   * },
   *   tokenContract.address1: {...}
   *
   */
  const config = {
    "0x6B175474E89094C44Da98b954EedeAC495271d0F": {
      "0x1974f84881Af4204a21f18c43D7c4d9Dee331Bb5":
        "0x69b24394dd5fcb36e2323a72fa862921f86bb0b4a80e3cb9dcb0c57a59c9bdf9",
      "0x8e097ed5FC6B357Ff15a9a7f3D41cDF5B4a05553":
        "0xd109c2b690fc11f278729dca2fbda42000bf7dbdfe3e71e42ca94d1022236be2",
      "0xFc1850fDd03F596867318EbD303d6256150d657e":
        "0xe66d2125d91fcfc00d713020bf264edffb947787b8184b8a4acadcf7a8170a60",
    },
    "0xdAC17F958D2ee523a2206206994597C13D831ec7": {
      "0x1974f84881Af4204a21f18c43D7c4d9Dee331Bb5":
        "0x69b24394dd5fcb36e2323a72fa862921f86bb0b4a80e3cb9dcb0c57a59c9bdf9",
      "0x8e097ed5FC6B357Ff15a9a7f3D41cDF5B4a05553":
        "0xd109c2b690fc11f278729dca2fbda42000bf7dbdfe3e71e42ca94d1022236be2",
      "0xFc1850fDd03F596867318EbD303d6256150d657e":
        "0xe66d2125d91fcfc00d713020bf264edffb947787b8184b8a4acadcf7a8170a60",
    },
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
      "0x1974f84881Af4204a21f18c43D7c4d9Dee331Bb5":
        "0xf60c83e9a7db0106e80d1a4ade9d8823b6302c5b429ac7ab1c1626fb3145cc57",
      "0x8e097ed5FC6B357Ff15a9a7f3D41cDF5B4a05553":
        "0xb440dfcd6fa4d87862365c517b4c9011a5db4d027c7bfe1fbba53769e3340de1",
    },
  };

  // Set balance directly by manipulating the contract storage
  await setTokenBalance(
    account,
    token,
    amount,
    config[token.address.toLowerCase()]
      ? config[token.address][account]
      : undefined,
    hre
  );

  // Print out mapped slots and add them to config above
  //console.log(mappedFundingSlots);
};

module.exports = {
  setERC20TokenBalance,
  hardhatSetBalance,
};
