import { formatCurrencyMinMaxDecimals, formatCurrency } from 'utils/math'
import { fbt } from 'fbt-runtime'
import { ethers } from 'ethers'

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
export function addStakeTxHashToWaitingBuffer(
  hash,
  stakeAmount,
  duration,
  end = '',
  isClaimHash = false
) {
  temporaryHashStorage = getTempHashStorage()
  const formattedDuration =
    typeof duration === 'string' ? duration : formatBn(duration, 0)
  let storageKey = `${formattedDuration}_${stakeAmount}`
  if (end) {
    storageKey += '_' + formatCurrency(end / 1000, 1).replaceAll(',', '')
  }

  let obj
  // if already present in local storage fetch that
  if (temporaryHashStorage[storageKey]) {
    obj = temporaryHashStorage[storageKey]
  } else {
    obj = {
      amount: stakeAmount,
      duration: formattedDuration,
    }
  }

  if (isClaimHash) {
    obj.claimHash = hash
  } else {
    obj.hash = hash
  }

  temporaryHashStorage[storageKey] = obj

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
      const tempClaimHashKey = `${keyDuration}_${keyAmount}_${keyEnd}`
      const resilientHashKey = `${keyDuration}_${keyAmount}_${keyEnd}`

      let hash, claimHash
      // If we find the key in more accurate storage just return that
      if (resilientHashStorage[resilientHashKey]) {
        const entry = resilientHashStorage[resilientHashKey]
        hash = entry.hash
        claimHash = entry.claimHash

        // If claim hash is found in temporary storage append it to the permanent storage
        if (temporaryHashStorage[tempClaimHashKey]) {
          claimHash = temporaryHashStorage[tempClaimHashKey].claimHash
          entry.claimHash = claimHash
          delete temporaryHashStorage[tempClaimHashKey]
          resilientHashStorage[resilientHashKey] = entry
        }

        // If entry is found in the temporary storage move it to a more accurate storage
      } else if (temporaryHashStorage[tempHashKey]) {
        const entry = temporaryHashStorage[tempHashKey]
        hash = entry.hash
        delete temporaryHashStorage[tempHashKey]
        resilientHashStorage[resilientHashKey] = entry
      }

      return {
        ...stake,
        hash,
        claimHash,
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

export function getTimeLeftText(stake, shortenDisplayedDuration = false) {
  let text = ''

  if (!stake.hasVested) {
    if (shortenDisplayedDuration) {
      if (stake.daysLeft > 1) {
        text = fbt(
          fbt.param('days left', Math.floor(stake.daysLeft)) + 'd left',
          'staking days left short'
        )
      } else if (stake.hoursLeft > 1) {
        text = fbt(
          fbt.param('hours left', Math.floor(stake.hoursLeft)) + 'h left',
          'staking hours left short'
        )
      } else if (stake.minutesLeft > 1) {
        text = fbt(
          fbt.param('minutes left', Math.floor(stake.minutesLeft)) + 'm left',
          'staking minutes left short'
        )
      } else if (stake.secondsLeft > 1) {
        text = fbt(
          fbt.param('seconds left', Math.floor(stake.secondsLeft)) + 's left',
          'staking seconds left short'
        )
      }
    } else {
      if (stake.daysLeft > 1) {
        text = fbt(
          fbt.param('days left', Math.floor(stake.daysLeft)) + ' days left',
          'staking days left'
        )
      } else if (stake.hoursLeft > 1) {
        text = fbt(
          fbt.param('hours left', Math.floor(stake.hoursLeft)) + ' hours left',
          'staking hours left'
        )
      } else if (stake.minutesLeft > 1) {
        text = fbt(
          fbt.param('minutes left', Math.floor(stake.minutesLeft)) +
            ' minutes left',
          'staking minutes left'
        )
      } else if (stake.secondsLeft > 1) {
        text = fbt(
          fbt.param('seconds left', Math.floor(stake.secondsLeft)) +
            ' seconds left',
          'staking seconds left'
        )
      }
    }
  }

  return text
}

export function enrichStakeData(stake) {
  const adjustedRate = (365 * stake.rate) / (stake.duration / (24 * 60 * 60))

  const interest = stake.amount * stake.rate
  let end = parseFloat(stake.end) * 1000
  let durationLeft = end - Date.now()
  const duration = parseFloat(stake.duration) * 1000
  const hasVested = end < Date.now()
  const minutes3 = 3 * 60 * 1000
  const hours2 = 2 * 60 * 60 * 1000

  /* there is this weird case that is happening where blockchain time and browser time can be minutes out of sync.
   * The downside of that is that interest doesn't start accruing (animating) right away and it can take a couple of
   * minutes to start.
   *
   * To solve the issue we modify move the end time 3 minutes into the past if the stake is in its initial 2 hours of
   * staking period.
   */
  if (!hasVested) {
    const timeFromStart = durationLeft - duration
    if (
      (timeFromStart > 0 && timeFromStart < minutes3) ||
      (timeFromStart < 0 && Math.abs(timeFromStart) < hours2)
    ) {
      end = end - minutes3
      durationLeft = end - Date.now()
    }
  }

  let daysLeft, hoursLeft, minutesLeft, secondsLeft, percentageVested
  if (!hasVested) {
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

  let interestAccrued = parseFloat(interest) * percentageVested
  let interestRemaining = parseFloat(interest) * (1 - percentageVested)

  // to avoid the use of scientific notation that messes up the calculations
  const minDisplayedInterestValue = 0.000001
  if (interestAccrued < minDisplayedInterestValue) {
    interestAccrued = 0
  }
  if (interestRemaining < minDisplayedInterestValue) {
    interestRemaining = 0
  }

  let status = 'Earning' // Earning, Unlocked, Complete
  if (stake.paid) {
    status = 'Complete'
  } else if (hasVested) {
    status = 'Unlocked'
  }

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
    totalToDate: interestAccrued + parseFloat(stake.amount),
    durationDays: durationToDays(duration),
    total: parseFloat(stake.amount) + interest,
    rate: adjustedRate,
  }
}
