import { formatCurrencyMinMaxDecimals } from 'utils/math'
import ethers from 'ethers'

const formatBn = (amount, decimals) => {
  return ethers.utils.formatUnits(amount, decimals)
}

export function durationToDays(duration) {
  return formatCurrencyMinMaxDecimals(duration / 24 / 60 / 60 / 1000, {
    minDecimals: 0,
    maxDecimals: 6,
  })
}

export function formatRate(rate) {
  return formatCurrencyMinMaxDecimals(rate * 100, {
    minDecimals: 0,
    maxDecimals: 1,
  })
}

const tempHashStorageKey = 'temporary_tx_hash_storage'
const resilientHashStorageKey = 'resilient_tx_hash_storage'
// Temporary hash storage that maps duration, amount and hash of a transaction
let temporaryHashStorage = null
// More accurate version of hash storage that besides the duration, amount and hash also stores end of staking
let resilientHashStorage = null

const saveTempHashStorage = (tempStorage) => {
  localStorage.setItem(tempHashStorageKey, JSON.stringify(tempStorage))
}
const saveResilientHashStorage = (resilientHashStorage) => {
  localStorage.setItem(
    resilientHashStorageKey,
    JSON.stringify(resilientHashStorage)
  )
}
const getResilientHashStorage = () => {
  if (!resilientHashStorage) {
    resilientHashStorage = JSON.parse(
      localStorage.getItem(resilientHashStorageKey)
    )
  }

  return resilientHashStorage || {}
}
const getTempHashStorage = () => {
  if (!temporaryHashStorage) {
    temporaryHashStorage = JSON.parse(localStorage.getItem(tempHashStorageKey))
  }

  return temporaryHashStorage || {}
}

/* We want to be able to connect the stake transaction hashes with the stake entries returned
 * by the contract. In the dapp we remember the combination of hash, duration and amount and store it to localStorage.
 */
export function addStakeTxHashToWaitingBuffer(hash, stakeAmount, duration) {
  temporaryHashStorage = getTempHashStorage()
  const formattedDuration = formatBn(duration, 0)

  temporaryHashStorage[`${formattedDuration}_${stakeAmount}`] = {
    hash,
    amount: stakeAmount,
    duration: formattedDuration,
  }

  saveTempHashStorage(temporaryHashStorage)
}

export function decorateContractStakeInfoWithTxHashes(stakes) {
  try {
    temporaryHashStorage = getTempHashStorage()
    resilientHashStorage = getResilientHashStorage()

    const decoratedStakes = stakes.map((stake) => {
      const keyDuration = formatBn(stake.duration, 0)
      const keyEnd = formatBn(stake.end, 0)
      const keyAmount = formatBn(stake.amount, 18)
      const tempHashKey = `${keyDuration}_${keyAmount}`
      const resilientHashKey = `${keyDuration}_${keyAmount}_${keyEnd}`

      let hash
      if (resilientHashStorage[resilientHashKey]) {
        hash = resilientHashStorage[resilientHashKey].hash
      } else if (temporaryHashStorage[tempHashKey]) {
        const entry = temporaryHashStorage[tempHashKey]
        hash = entry.hash
        delete temporaryHashStorage[tempHashKey]
        resilientHashStorage[resilientHashKey] = entry
      }

      return {
        ...stake,
        hash,
      }
    })

    saveTempHashStorage(temporaryHashStorage)
    saveResilientHashStorage(resilientHashStorage)

    return decoratedStakes
  } catch (e) {
    console.error(
      `Something wrong when decorating stakes with hashes: ${e.message}`
    )
    console.error(e)
    return stakes
  }
}

export function enrichStakeData(stake) {
  const interest = stake.amount * stake.rate
  const end = parseFloat(stake.end) * 1000
  const duration = parseFloat(stake.duration) * 1000

  const hasVested = end < Date.now()
  let daysLeft,
    hoursLeft,
    minutesLeft,
    secondsLeft,
    percentageVested,
    durationLeft
  if (!hasVested) {
    durationLeft = end - Date.now()
    percentageVested = Math.max(
      Math.min(1, parseFloat(duration - durationLeft) / duration),
      0
    )
    secondsLeft = durationLeft / 1000
    minutesLeft = secondsLeft / 60
    hoursLeft = minutesLeft / 60
    daysLeft = hoursLeft / 24
  } else {
    percentageVested = 1
    secondsLeft = 0
    durationLeft = 0
    minutesLeft = 0
    hoursLeft = 0
    daysLeft = 0
  }

  const interestAccrued = parseFloat(interest) * percentageVested
  const interestRemaining = parseFloat(interest) * (1 - percentageVested)
  let status = 'Earning' // Earning, Unlocked, Complete
  if (stake.paid) {
    status = 'Complete'
  } else if (hasVested) {
    status = 'Unlocked'
  }

  const localStorageKey = `stake_tx_storage_${stake.end}_${stake.duration}`
  return {
    ...stake,
    end,
    startDate: new Date(end - duration),
    endDate: new Date(end),
    duration,
    hasVested,
    daysLeft,
    hoursLeft,
    minutesLeft,
    secondsLeft,
    durationLeft,
    percentageVested,
    interest,
    interestAccrued,
    interestRemaining,
    status,
    setTxHash: (txHash) => {
      localStorage.setItem(localStorageKey, txHash)
    },
    getTxHash: () => {
      localStorage.getItem(localStorageKey)
    },
    totalToDate: interestAccrued + parseFloat(stake.amount),
    durationDays: durationToDays(duration),
    total: parseFloat(stake.amount) + interest,
  }
}
