const { setBalance, setStorageAt } = require("@nomicfoundation/hardhat-network-helpers");
const ethers = require("ethers");
const addresses = require("../utils/addresses");
const { parseEther } = ethers.utils;
const { units } = require("../utils/units");

/**
 *
 * Based on https://blog.euler.finance/brute-force-storage-layout-discovery-in-erc20-contracts-with-hardhat-7ff9342143ed
 * @export
 * @param {string} tokenAddress
 * @return {*}  {Promise<number>}
 */
const findBalancesSlot = async (tokenAddress) => {
  const { ethers, network } = await import("hardhat")

  const encode = (types, values) => ethers.utils.defaultAbiCoder.encode(types, values)

  const account = addresses.zero
  const probeA = encode(["uint"], [1])
  const probeB = encode(["uint"], [2])
  const token = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/ERC20.sol", tokenAddress)

  for (let i = 0; i < 100; i += 1) {
    const probedSlot = ethers.utils.keccak256(encode(["address", "uint"], [account, i]))
    if (probedSlot.startsWith("0x0")) continue
    // remove padding for JSON RPC
    // while (probedSlot.startsWith("0x0")) {
    //     probedSlot = `0x${probedSlot.slice(3)}`
    // }

    const prev = await network.provider.send("eth_getStorageAt", [tokenAddress, probedSlot, "latest"])
    // make sure the probe will change the slot value
    const probe = prev === probeA ? probeB : probeA

    await setStorageAt(tokenAddress, probedSlot, probe)

    const balance = await token.balanceOf(account)
    // reset to previous value
    await setStorageAt(tokenAddress, probedSlot, prev)
    if (balance.eq(ethers.BigNumber.from(probe))) return i
  }
  throw new Error("Balances slot not found!")
}

const toBytes32 = (bn) => ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32))

/**
 * Set the Balance of a user under an ERC20 token
 *
 * @param {string} userAddress
 * @param {object} tokenContract
 * @param {BN} amount
 * @param {string} [slotIndex]
 * @return {*}  {Promise<void>}
 */
const setTokenBalance = async (userAddress, tokenContract, amount, slotIndex=undefined, hre) => {
  const amountBn = await units(amount, tokenContract);
  let index = slotIndex
  if (slotIndex === undefined) {
    const balanceSlot = await findBalancesSlot(tokenContract.address)
    // key, slot
    index = utils.solidityKeccak256(["uint256", "uint256"], [userAddress, balanceSlot])
    log(`slotIndex: ${index} for tokenAddress: ${tokenContract.address}, userAddress: ${userAddress}`)
  }

  log(`Setting balance of user  ${userAddress} with token ${tokenAddress.address} at index ${index}`)
  await setStorageAt(tokenAddress.address, toBytes32(BN.from(index)), toBytes32(amountBn).toString())
}

/**
 * Sets ETH balance of an account
 *
 * @param {Account} account to set balance
 * @param {number} [amount=10000] Amount of ETH to set
 */
async function hardhatSetBalance(address, amount = "10000", hre) {
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
	const config = {
		//addresses.mainnet.WETH.toLowerCase(): "0xa9b759fed45888fb7af7fd8c229074535d6dd9f041494f8276fb277331ee6b1a"
	};

  // Set balance directly by manipulating the contract storage
  await setTokenBalance(
      account.address,
      token,
      amount,
      config[token.address.toLowerCase()],
      hre
  )
}

module.exports = {
	setERC20TokenBalance,
	hardhatSetBalance
}