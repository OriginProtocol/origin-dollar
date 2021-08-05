import React, { useEffect } from 'react'
import { ethers } from 'ethers'
import { useStoreState } from 'pullstate'

import ContractStore from 'stores/ContractStore'
import AccountStore from 'stores/AccountStore'
import {
  mintAbsoluteGasLimitBuffer,
  mintPercentGasLimitBuffer,
  redeemPercentGasLimitBuffer,
} from 'utils/constants'


const useCurrencySwapper = (swapMode, amountRaw, selectedCoin, priceToleranceValue) => {
	const {
		vault: vaultContract,
		ousd: ousdContract,
		usdt: usdtContract,
		usdc: usdcContract,
		dai: daiContract,
		flipper
	} = useStoreState(ContractStore, (s) => s.contracts)

	const allowances = useStoreState(AccountStore, (s) => s.allowances)
	const allowancesLoaded = typeof allowances === 'object'
		&& allowances.ousd
		&& allowances.usdt
		&& allowances.usdc
		&& allowances.dai

	const coinInfoList = {
    usdt: {
      contract: usdtContract,
      decimals: 6,
    },
    usdc: {
      contract: usdcContract,
      decimals: 6,
    },
    dai: {
      contract: daiContract,
      decimals: 18,
    },
  }

  const { contract: coinContract, decimals } = coinInfoList[selectedCoin]
  //const mintAddress = coinContract.address

	const amount = parseFloat(amountRaw)
	// TODO: what swap contract is selected?
	const needsApproval = amount > 0 && parseFloat(allowances[selectedCoin].vault) < amount

	const mintAmount = ethers.utils
    .parseUnits(amountRaw.toString(), decimals)
    .toString()

 	const selectedCoinAmountWithTolerance =
    amount -
    (amount *
      (priceToleranceValue ? priceToleranceValue : 0)) /
      100

  const minMintAmount = ethers.utils
    .parseUnits(selectedCoinAmountWithTolerance.toString(), decimals)
    .toString()

	const _vaultMint = async (callObject, options = {}) => {
    return await callObject.mint(
      coinContract.address,
      mintAmount,
      minMintAmount,
      options
    )
	}

	const mintVaultGasEstimate = async () => {
		return (await _vaultMint(vaultContract.estimateGas)).toNumber()
	}

	const mintVault = async () => {
		const gasEstimate = await mintVaultGasEstimate()
		const gasLimit = parseInt(
      gasEstimate +
        Math.max(
          mintAbsoluteGasLimitBuffer,
          gasEstimate * mintPercentGasLimitBuffer
        )
    )

		return {
			result: await _vaultMint(vaultContract, { gasLimit }),
			mintAmount,
      minMintAmount,
    }
	}

	return {
		allowancesLoaded,
		needsApproval,
		mintVault,
		mintVaultGasEstimate
	}
}

export default useCurrencySwapper