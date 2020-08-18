import React from 'react'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'
import { get } from 'lodash'

import Layout from 'components/layout'
import Nav from 'components/dappNav'
import { AccountStore } from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import { currencies } from 'constants/Contract'

const governorAddress = '0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4'

const Dashboard = ({ locale, onLocale }) => {
  const allowances = useStoreState(AccountStore, s => s.allowances)
  const balances = useStoreState(AccountStore, s => s.balances)

  const account = useStoreState(AccountStore, s => s.address)

  const { Vault, MockUSDT, MockDAI, MockTUSD, MockUSDC } = useStoreState(ContractStore, s => s.contracts || {})

  const isGovernor = account && account === governorAddress


  const mintUSDT = async () => {
    await MockUSDT.mint(
      ethers.utils.parseUnits('1500.0', await MockUSDT.decimals())
    )
  }

  const approveUSDT = async () => {
    await MockUSDT.approve(
      Vault.address,
      ethers.utils.parseUnits('123.0', await MockUSDT.decimals())
    )
  }

  const mintDai = async () => {
    await MockDAI.mint(
      ethers.utils.parseUnits('1500.0', await MockDAI.decimals())
    )
  }

  const approveDai = async () => {
    await MockDAI.approve(
      Vault.address,
      ethers.utils.parseUnits('123.0', await MockDAI.decimals())
    )
  }

  const mintTusd = async () => {
    await MockTUSD.mint(
      ethers.utils.parseUnits('1500.0', await MockTUSD.decimals())
    )
  }

  const approveTusd = async () => {
    await MockTUSD.approve(
      Vault.address,
      ethers.utils.parseUnits('123.0', await MockTUSD.decimals())
    )
  }

  const mintUsdc = async () => {
    await MockUSDC.mint(
      ethers.utils.parseUnits('1500.0', await MockUSDC.decimals())
    )
  }

  const approveUsdc = async () => {
    await MockUSDC.approve(
      Vault.address,
      ethers.utils.parseUnits('123.0', await MockUSDC.decimals())
    )
  }

  const buyOusd = async () => {
    await Vault.depositAndMint(
      MockUSDT.address,
      ethers.utils.parseUnits('100.0', await MockUSDT.decimals())
    )
  }

  const depositYield = async () => {
    await Vault.depositYield(
      MockUSDT.address,
      ethers.utils.parseUnits('10.0', await MockUSDT.decimals())
    )
  }

  const tableRows = () => {
    return Object.keys(currencies).map((x) => (
      <tr key={x}>
        <td>{x.toUpperCase()}</td>
        <td>{get(allowances, x) > 100000000000 ? 'Unlimited' : 'None'}</td>
        <td>1</td>
        <td>{get(balances, x)}</td>
        <td>{get(allowances, x)}</td>
      </tr>
    ))
  }

  return (
  	<>
  		<Layout dapp>
        <Nav
        	dapp
        	locale={locale}
        	onLocale={onLocale}
        />
	      <div className="my-5">
	      {account && (
	        <>
	          <h1>Balances</h1>
	          <div className="card w25 mb-4">
	            <div className="card-body">
	              <h5 className="card-title">Current Balance</h5>
	              <p className="card-text">{get(balances, 'ousd')}</p>
	            </div>
	          </div>
	          <table className="table table-bordered">
	            <thead>
	              <tr>
	                <td>Asset</td>
	                <td>Permission</td>
	                <td>Exchange Rate</td>
	                <td>Your Balance</td>
                  <td>Allowance</td>
	              </tr>
	            </thead>
	            <tbody>{tableRows()}</tbody>
	          </table>
            <div className="d-flex flex-wrap">
              {isGovernor && (
                <div className="btn btn-primary my-4 mr-3" onClick={depositYield}>
                  Deposit $10 Yield
                </div>
              )}
              <div className="btn btn-primary my-4 mr-3" onClick={mintUSDT}>
                Mint USDT
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveUSDT}>
                Approve USDT
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={mintDai}>
                Mint DAI
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveDai}>
                Approve Dai
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={mintTusd}>
                Mint TUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveTusd}>
                Approve TUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={mintUsdc}>
                Mint USDC
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveUsdc}>
                Approve USDC
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={buyOusd}>
                Buy OUSD
              </div>
            </div>
	        </>
	      )}
	    </div>
	    </Layout>
	    <style jsx>{`
	      .home {
    			padding-top: 80px;
	      }
	  	`}</style>
    </>

  )
}

export default Dashboard

