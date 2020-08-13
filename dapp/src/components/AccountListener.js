import React, { useState, useEffect } from 'react'
import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import { usePrevious } from 'utils/helperHooks'
import { useWeb3React } from '@web3-react/core'
import { useStoreState } from 'pullstate'

const AccountStatus = props => {
	const { account } = useWeb3React()
	const prevAccount = usePrevious(account)
	const contracts = useStoreState(ContractStore, s => s.contracts)

	const displayCurrency = async (balance, contract) => {
    if (!balance) return
    return ethers.utils.formatUnits(balance, await contract.decimals())
  }

	const loadData = async () => {
		if (!contracts) {
			console.warn('Contracts not yet loaded!')
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

	  loadData()
	  window.balanceInterval = setInterval(() => {
	    loadData()
	  }, 2000)

	}, [account])

	return ("")
}

export default AccountStatus