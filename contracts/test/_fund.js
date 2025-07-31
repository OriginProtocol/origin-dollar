const {
  setBalance,
  setStorageAt,
  getStorageAt,
} = require("@nomicfoundation/hardhat-network-helpers");
const ethrs = require("ethers");
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
const addresses = require("../utils/addresses");

const log = require("../utils/logger")("test:_fund");

const mappedFundingSlots = {};
const balancesContractSlotCache = {
  [addresses.mainnet.stETH.toLowerCase()]: [0, false],
  [addresses.mainnet.frxETH.toLowerCase()]: [0, false],
  [addresses.mainnet.rETH.toLowerCase()]: [1, false],
  [addresses.mainnet.sfrxETH.toLowerCase()]: [3, false],
  [addresses.mainnet.ThreePoolToken.toLowerCase()]: [3, true],
  [addresses.mainnet.DAI.toLowerCase()]: [2, false],
  [addresses.mainnet.USDS.toLowerCase()]: [2, false],
  [addresses.mainnet.USDC.toLowerCase()]: [9, false],
  [addresses.mainnet.USDT.toLowerCase()]: [2, false],
  [addresses.mainnet.TUSD.toLowerCase()]: [14, false],
  [addresses.mainnet.OGN.toLowerCase()]: [0, true],
  [addresses.mainnet.OETHProxy.toLowerCase()]: [157, false],
  [addresses.mainnet.OUSDProxy.toLowerCase()]: [157, false],
};

/**
 *
 * Based on https://blog.euler.finance/brute-force-storage-layout-discovery-in-erc20-contracts-with-hardhat-7ff9342143ed
 * @export
 * @param {string} tokenAddress
 * @return {*}  {Promise<[number, boolean]>}
 */
const findBalancesSlot = async (tokenAddress) => {
  tokenAddress = tokenAddress.toLowerCase();
  if (balancesContractSlotCache[tokenAddress]) {
    log(
      `Found balance slot ${balancesContractSlotCache[tokenAddress]} for ${tokenAddress} in cache`
    );
    return balancesContractSlotCache[tokenAddress];
  }

  const { ethers } = (await import("hardhat")).default;

  const encode = (types, values) => defaultAbiCoder.encode(types, values);

  const account = addresses.ETH;
  const probeA = encode(
    ["uint"],
    [parseEther("99999999999999999999999999999999")]
  );
  const probeB = encode(
    ["uint"],
    [parseEther("77777777777777777777777777777777")]
  );

  const token = await ethers.getContractAt(erc20Abi, tokenAddress);

  for (let i = 0; i < 100; i += 1) {
    const slots = [
      keccak256(encode(["address", "uint"], [account, i])),
      keccak256(encode(["uint", "address"], [i, account])),
    ];
    for (const probedSlot of slots) {
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

      // For certain tokens with computed balances (aka rebasing tokens),
      // balance == probe won't be always true.
      if (
        balance.eq(ethrs.BigNumber.from(probe))
        // || balance.gt(ethrs.BigNumber.from(prev))
      ) {
        const isVyper = probedSlot == slots[1];
        balancesContractSlotCache[tokenAddress] = [i, isVyper];
        log(
          `Caching balance slot ${i} for ${tokenAddress}. is Vyper? ${isVyper} `
        );
        return [i, isVyper];
      }
    }
  }
  throw new Error(`Balances slot not found for ${tokenAddress}`);
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
  slotIndex = undefined
) => {
  const amountBn = ethrs.BigNumber.isBigNumber(amount)
    ? amount
    : await units(amount, tokenContract);
  let index = slotIndex;
  if (slotIndex === undefined) {
    const [balanceSlot, isVyper] = await findBalancesSlot(
      tokenContract.address
    );
    // log(`Found balance slot ${balanceSlot} for ${tokenContract.address}`);
    // key, slot
    index = solidityKeccak256(
      ["uint256", "uint256"],
      isVyper ? [balanceSlot, userAddress] : [userAddress, balanceSlot]
    );

    if (!mappedFundingSlots[tokenContract.address])
      mappedFundingSlots[tokenContract.address] = {};

    mappedFundingSlots[tokenContract.address][userAddress] = index;
  }

  log(
    `Setting balance of user ${userAddress} with token ${tokenContract.address}`
  );
  await setStorageAt(
    tokenContract.address,
    toBytes32(ethers.BigNumber.from(index)),
    toBytes32(amountBn).toString()
  );
};

/**
 * Sets ETH balance of an account
 *
 * @param {Account} account to set balance
 * @param {number} [amount=10000] Amount of ETH to set
 */
async function hardhatSetBalance(address, amount = "10000") {
  await setBalance(address, parseEther(amount));
}

/**
 * Sets balance to a given account
 *
 * @param {Account} account to set balance
 * @param {[ERC20]} tokensTransfer Tokens that sets the balance by token.transfer tx
 * @param {number} [amount=10000] Amount of tokens to set
 */
const setERC20TokenBalance = async (account, token, amount = "10000") => {
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
    config[token.address] ? config[token.address][account] : undefined
  );

  // // Print out mapped slots and add them to config above
  // console.log(balancesContractSlotCache);
};

module.exports = {
  setERC20TokenBalance,
  hardhatSetBalance,
};
