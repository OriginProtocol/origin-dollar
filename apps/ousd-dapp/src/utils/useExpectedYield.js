import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { BigNumber } from 'ethers'

import AccountStore from 'stores/AccountStore'
import YieldStore from 'stores/YieldStore'
import { animateValue } from 'utils/animation'
import { usePrevious } from 'utils/hooks'

const useExpectedYield = (isWrapped = false) => {
  const mintAnimationLimit = 0.01

  const currentCreditsPerToken = useStoreState(
    YieldStore,
    (s) => s.currentCreditsPerToken
  )
  const nextCreditsPerToken = useStoreState(
    YieldStore,
    (s) => s.nextCreditsPerToken
  )
  const expectedIncrease = useStoreState(YieldStore, (s) =>
    isWrapped ? s.expectedIncreaseWrapped : s.expectedIncrease
  )
  const animatedExpectedIncrease = useStoreState(YieldStore, (s) =>
    isWrapped ? s.animatedExpectedIncreaseWrapped : s.animatedExpectedIncrease
  )

  const creditsBalanceOf = useStoreState(AccountStore, (s) =>
    isWrapped ? s.creditsWrapped : s.creditsBalanceOf
  )
  const prevExpectedIncrease = usePrevious(expectedIncrease)

  const expectedIncreaseAnimation = (from, to, isWrapped) => {
    return animateValue({
      from: parseFloat(from) || 0,
      to: parseFloat(to),
      callbackValue: (val) => {
        YieldStore.update((s) => {
          if (isWrapped) {
            s.animatedExpectedIncreaseWrapped = Number(val.toFixed(2))
          } else {
            s.animatedExpectedIncrease = Number(val.toFixed(2))
          }
        })
      },
      onCompleteCallback: () => {},
      // non even duration number so more of the decimals in ousdBalance animate
      duration: 1985,
      id: 'expected-increase-animation',
      stepTime: 30,
    })
  }

  useEffect(() => {
    const expectedIncreaseNum = parseFloat(expectedIncrease)
    const prevExpectedIncreaseNum = parseFloat(prevExpectedIncrease)
    // user must have minted the OUSD
    if (
      typeof expectedIncreaseNum === 'number' &&
      typeof prevExpectedIncreaseNum === 'number' &&
      Math.abs(expectedIncreaseNum - prevExpectedIncreaseNum) >
        mintAnimationLimit
    ) {
      expectedIncreaseAnimation(
        prevExpectedIncreaseNum,
        expectedIncreaseNum,
        isWrapped
      )
    } else if (
      typeof expectedIncreaseNum === 'number' &&
      typeof prevExpectedIncreaseNum !== 'number'
    ) {
      expectedIncreaseAnimation(0, expectedIncreaseNum, isWrapped)
    }
  }, [expectedIncrease])

  useEffect(() => {
    const creditsBalanceOfNum = parseFloat(creditsBalanceOf)
    if (
      typeof creditsBalanceOfNum === 'number' &&
      typeof nextCreditsPerToken === 'number' &&
      typeof currentCreditsPerToken === 'number'
    ) {
      const yields = parseFloat(
        creditsBalanceOfNum / nextCreditsPerToken -
          creditsBalanceOfNum / currentCreditsPerToken
      )
      if (!isNaN(Math.max(0, yields))) {
        YieldStore.update((s) => {
          if (isWrapped) {
            s.expectedIncreaseWrapped = Math.max(0, yields)
          } else {
            s.expectedIncrease = Math.max(0, yields)
          }
        })
      }
    }
  }, [creditsBalanceOf, currentCreditsPerToken, nextCreditsPerToken])

  return {
    animatedExpectedIncrease,
  }
}

export default useExpectedYield
