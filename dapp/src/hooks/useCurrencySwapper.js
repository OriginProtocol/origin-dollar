import React, { useEffect } from 'react'
import { ethers, BigNumber } from 'ethers'
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
		flipper,
		uniV3SwapRouter
	} = useStoreState(ContractStore, (s) => s.contracts)

	const allowances = useStoreState(AccountStore, (s) => s.allowances)
	const account = useStoreState(AccountStore, s => s.address)
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
  // plain amount as displayed in UI (not in wei format)
	const amount = parseFloat(amountRaw)
	// TODO: what swap contract is selected?
	const needsApproval = amount > 0 && parseFloat(allowances[selectedCoin].vault) < amount


	const calculateAmounts = (rawInputAmount, decimals) => {
		const mintAmount = ethers.utils
	    .parseUnits(rawInputAmount.toString(), decimals)
	    .toString()

	 	const selectedCoinAmountWithTolerance =
	    amount -
	    (amount *
	      (priceToleranceValue ? priceToleranceValue : 0)) /
	      100

	  const minMintAmount = ethers.utils
	    .parseUnits(selectedCoinAmountWithTolerance.toString(), decimals)
	    .toString()

	  return {
	  	mintAmount,
	  	minMintAmount
	  }
	}

	const {
		mintAmount,
		minMintAmount
	} = calculateAmounts(amountRaw, decimals)

	const _mintVault = async (callObject, options = {}) => {
    return await callObject.mint(
      coinContract.address,
      mintAmount,
      minMintAmount,
      options
    )
	}

	const mintVaultGasEstimate = async () => {
		return (await _mintVault(vaultContract.estimateGas)).toNumber()
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
			result: await _mintVault(vaultContract, { gasLimit }),
			mintAmount,
      minMintAmount,
    }
	}


	const swapFlipper = async () => {
		// need to calculate these again, since Flipper takes all amount inputs in 18 decimal format
		const {
			mintAmount: mintAmountFlipper
		} = calculateAmounts(amountRaw, 18)

		let flipperResult
		if (swapMode === 'mint') {
			if (selectedCoin === 'dai') {
				flipperResult = await flipper.buyOusdWithDai(mintAmountFlipper)
			} else if (selectedCoin === 'usdt') {
				flipperResult = await flipper.buyOusdWithUsdt(mintAmountFlipper)
			} else if (selectedCoin === 'usdc') {
				flipperResult = await flipper.buyOusdWithUsdc(mintAmountFlipper)
			}
		} else {
			if (selectedCoin === 'dai') {
				flipperResult = await flipper.sellOusdForDai(mintAmountFlipper)
			} else if (selectedCoin === 'usdt') {
				flipperResult = await flipper.sellOusdForUsdt(mintAmountFlipper)
			} else if (selectedCoin === 'usdc') {
				flipperResult = await flipper.sellOusdForUsdc(mintAmountFlipper)
			}
		}
		
		return {
			result: flipperResult,
			mintAmount,
      minMintAmount,
    }
	}

	const _swapUniswap = async (callObject) => {
		if (selectedCoin !== 'usdt') {
			throw new Error('Uniswap can swap only between ousd & usdt')
		}

    return await callObject.exactInputSingle([
      swapMode === 'mint' ? usdtContract.address : ousdContract.address,
      swapMode === 'mint' ? ousdContract.address : usdtContract.address,
      500, // pre-defined Factory fee for stablecoins
      account, // recipient
      BigNumber.from(Date.now() + 2 * 60 * 1000), // deadline - 2 minutes from now
      mintAmount, // amountIn
      minMintAmount, // amountOutMinimum
      0 // sqrtPriceLimitX96
    ])
	}

	const swapUniswapGasEstimate = async () => {
		return (await _swapUniswap(uniV3SwapRouter.estimateGas)).toNumber()
	}

	const swapUniswap = async () => {
		return {
			result: await _swapUniswap(uniV3SwapRouter),
			mintAmount,
      minMintAmount,
    }
	}

	return {
		allowancesLoaded,
		needsApproval,
		mintVault,
		mintVaultGasEstimate,
		swapFlipper,
		swapUniswapGasEstimate,
		swapUniswap
	}
}

export default useCurrencySwapper