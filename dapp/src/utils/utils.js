
import addresses from 'constants/contractAddresses'
import { ethers } from 'ethers'

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Simple object check.
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item)
}

/**
 * Deep merge two objects.
 */
export function mergeDeep(target, ...sources) {
  if (!sources.length) {
    return target
  }
  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} })
        }
        mergeDeep(target[key], source[key])
      } else {
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return mergeDeep(target, ...sources)
}

/**
 * Get stable coin logs
 */

export const getStableCoinLogs = async (transactions) => {
  const data = {
    usdt: 0,
    dai: 0,
    usdc: 0,
    ousd: 0,
  }
  const stableCoins = [
    {
      address: addresses.mainnet.USDT.toLowerCase(),
      name: 'usdt',
      decimals: 6,
    },
    {
      address: addresses.mainnet.USDC.toLowerCase(),
      name: 'usdc',
      decimals: 6,
    },
    {
      address: addresses.mainnet.DAI.toLowerCase(),
      name: 'dai',
      decimals: 18,
    },
    {
      address: addresses.mainnet.OUSDProxy.toLowerCase(),
      name: 'ousd',
      decimals: 18,
    },
  ]

  await Promise.all(
    stableCoins.map((coin) => {
      const log = transactions.logs.find((log) => log.address.toLowerCase() === coin.address)
      if (log) {
        const value = ethers.BigNumber.from(log.data)
        data[coin.name] = parseFloat(value.toString()) / 10 * coin.decimals
      }
    })
  )

  return data
}