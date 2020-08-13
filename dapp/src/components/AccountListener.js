import React, { useState, useEffect } from 'react'
import AccountStore from 'stores/AccountStore'
import { usePrevious } from 'utils/helperHooks'
import { isCorrectNetwork } from 'utils/web3'
import { useWeb3React } from '@web3-react/core'
import { useStoreState } from 'pullstate'
import { setupContracts } from 'utils/contracts'

const AccountStatus = props => {
	const web3react = useWeb3React()
	const { account, chainId, library } = web3react
	const prevAccount = usePrevious(account)

	const displayCurrency = async (balance, contract) => {
    if (!balance) return
    return ethers.utils.formatUnits(balance, await contract.decimals())
  }

	const loadData = async (contracts) => {
		if (!contracts) {
			console.warn('Contracts not yet loaded!')
			return
		}
		if (!isCorrectNetwork(web3react)) {
			return	
		}

		const { MockUSDT, MockDAI, MockTUSD, MockUSDC, OUSD, Vault } = contracts

  	const loadBalances = async () => {
	    if (!account) return
	    
	    console.log("LOADING daTA: 1")
	    const ousd = await displayCurrency(await OUSD.balanceOf(account), OUSD)
	    console.log("LOADING daTA: 2")
	    const usdt = await displayCurrency(
	      await MockUSDT.balanceOf(account),
	      MockUSDT
	    )
	    const dai = await displayCurrency(await MockDAI.balanceOf(account), MockDAI)
	    const tusd = await displayCurrency(
	      await MockTUSD.balanceOf(account),
	      MockTUSD
	    )
	    const usdc = await displayCurrency(
	      await MockUSDC.balanceOf(account),
	      MockUSDC
	    )

	    AccountStore.update(s => {
		    s.balances = {
		      usdt,
		      dai,
		      tusd,
		      usdc,
		      ousd,
		    }
		  })
	  }

	  const loadAllowances = async () => {
	    const usdt = await displayCurrency(
	      await MockUSDT.allowance(account, Vault.address),
	      MockUSDT
	    )
	    const dai = await displayCurrency(
	      await MockDAI.allowance(account, Vault.address),
	      MockDAI
	    )
	    const tusd = await displayCurrency(
	      await MockTUSD.allowance(account, Vault.address),
	      MockTUSD
	    )
	    const usdc = await displayCurrency(
	      await MockUSDC.allowance(account, Vault.address),
	      MockUSDC
	    )

	    AccountStore.update(s => {
		    s.allowences = {
		      usdt,
		      dai,
		      tusd,
		      usdc,
		    }
		  })
	  }

	  await loadBalances()
	  await loadAllowances()
  }

	useEffect(() => {
		let accountData = null
	  if (account) {
	    accountData = {
	      address: account
	    }
	  }

	  AccountStore.update(s => {
	    s.account = accountData
	  })

	  if (window.balanceInterval) {
	  	clearInterval(window.balanceInterval)
	  }

	  if (!account) {
	  	return
	  }

	  const contracts = setupContracts(account, library)

	  loadData()
	  	window.balanceInterval = setInterval(() => {
	    loadData(contracts)
	  }, 2000)

	}, [account, chainId])

	return ("")
}

export default AccountStatus