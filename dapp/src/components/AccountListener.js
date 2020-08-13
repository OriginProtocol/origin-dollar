import React, { useState, useEffect } from 'react'
import AccountStore from 'stores/AccountStore'
import { usePrevious } from 'utils/helperHooks'
import { useWeb3React } from '@web3-react/core'

const AccountStatus = props => {
	const { account } = useWeb3React()
	const prevAccount = usePrevious(account)

	const loadData = async () => {
  	const loadBalances = async () => {
	    if (!account) return
	    const ousd = await OUSD.instance.balanceOf(account)
	    const usdt = await MockUSDT.instance.balanceOf(account)
	    const dai = await MockDAI.instance.balanceOf(account)
	    const tusd = await MockTUSD.instance.balanceOf(account)
	    const usdc = await MockUSDC.instance.balanceOf(account)
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
	    const usdt = await MockUSDT.instance.allowance(account, Vault.address)
	    const dai = await MockDAI.instance.allowance(account, Vault.address)
	    const tusd = await MockTUSD.instance.allowance(account, Vault.address)
	    const usdc = await MockUSDC.instance.allowance(account, Vault.address)
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

	  window.balanceInterval = setInterval(() => {
	    loadData()
	  }, 2000)

	}, [account])

	return ("")
}

export default AccountStatus