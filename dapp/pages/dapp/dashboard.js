import React from 'react'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'
import { get } from 'lodash'
import { useWeb3React } from '@web3-react/core'

import Layout from 'components/layout'
import Nav from 'components/Nav'
import { AccountStore } from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import { currencies } from 'constants/Contract'

const governorAddress = '0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4'

const Dashboard = ({ locale, onLocale }) => {
  const allowances = useStoreState(AccountStore, s => s.allowances)
  const balances = useStoreState(AccountStore, s => s.balances)
  const account = useStoreState(AccountStore, s => s.address)
  const { chainId } = useWeb3React()

  const { vault, usdt, dai, tusd, usdc, ousd } = useStoreState(ContractStore, s => s.contracts || {})
  const isMainnetFork = process.env.NODE_ENV === 'development' && chainId === 1337
  const isGovernor = account && account === governorAddress

  const mintByCommandLineOption = () => {
    if (isMainnetFork) {
      alert("To grant stable coins go to project's 'contracts' folder and run 'yarn run grant-stable-coins:fork' ")
    }
  }

  const notSupportedOption = () => {
    if (isMainnetFork) {
      alert("Not supported when running main net fork -> 'yarn run node:fork'")
    }
  }

  const clearAllAllowances = async () => {
    notSupportedOption()
    await usdt.decreaseAllowance(
      vault.address,
      ethers.utils.parseUnits(allowances['usdt'], await usdt.decimals())
    )

    await dai.decreaseAllowance(
      vault.address,
      ethers.utils.parseUnits(allowances['dai'], await dai.decimals())
    )

    // await tusd.decreaseAllowance(
    //   vault.address,
    //   ethers.utils.parseUnits(allowances['tusd'], await tusd.decimals())
    // )

    await usdc.decreaseAllowance(
      vault.address,
      ethers.utils.parseUnits(allowances['usdc'], await usdc.decimals())
    )
  }

  const mintUSDT = async () => {
    mintByCommandLineOption()
    await usdt.mint(
      ethers.utils.parseUnits('1500.0', await usdt.decimals())
    )
  }

  const approveUSDT = async () => {
    notSupportedOption()
    await usdt.approve(
      vault.address,
      ethers.utils.parseUnits('10000000.0', await usdt.decimals())
    )
  }

  const mintDai = async () => {
    mintByCommandLineOption()
    await dai.mint(
      ethers.utils.parseUnits('1500.0', await dai.decimals())
    )
  }

  const approveDai = async () => {
    notSupportedOption()
    await dai.approve(
      vault.address,
      ethers.utils.parseUnits('10000000.0', await dai.decimals())
    )
  }

  const mintTusd = async () => {
    mintByCommandLineOption()
    await tusd.mint(
      ethers.utils.parseUnits('1500.0', await tusd.decimals())
    )
  }

  const unPauseDeposits = async () => {
    notSupportedOption()
    await vault.unpauseDeposits()
  }

  const approveTusd = async () => {
    notSupportedOption()
    await tusd.approve(
      vault.address,
      ethers.utils.parseUnits('10000000.0', await tusd.decimals())
    )
  }

  const mintUsdc = async () => {
    mintByCommandLineOption()
    await usdc.mint(
      ethers.utils.parseUnits('1500.0', await usdc.decimals())
    )
  }

  const approveUsdc = async () => {
    notSupportedOption()
    await usdc.approve(
      vault.address,
      ethers.utils.parseUnits('10000000.0', await usdc.decimals())
    )
  }

  const buyOusd = async () => {
    await ousd.mint(
      usdt.address,
      ethers.utils.parseUnits('100.0', await usdt.decimals())
    )
  }

  const depositYield = async () => {
    notSupportedOption()
    await ousd.depositYield(
      usdt.address,
      ethers.utils.parseUnits('10.0', await usdt.decimals())
    )
  }

  const approveOUSD = async () => {
    notSupportedOption()
    await ousd.approve(
      vault.address,
      ethers.utils.parseUnits('10000000.0', await ousd.decimals())
    )
  }

  const setupSupportAssets = async () => {
    notSupportedOption()
    await vault.supportAsset(
      dai.address,
      "DAI"
    )

    await vault.supportAsset(
      usdt.address,
      "USDT"
    )

    await vault.supportAsset(
      usdc.address,
      "USDC"
    )
  }

  const tableRows = () => {
    return [...Object.keys(currencies), 'ousd'].map((x) => (
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
        {!account && <h1 className="text-white">No account :(</h1>}
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
              <div className="btn btn-primary my-4 mr-3" onClick={clearAllAllowances}>
                Clear All Allowances
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={buyOusd}>
                Buy OUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={unPauseDeposits}>
                Un-Pause Deposits
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveOUSD}>
                Approve OUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={setupSupportAssets}>
                Support Dai & Usdt & Usdc
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

        table {
          background-color: white;
        }

        @media (max-width: 799px) {
          .home {
            padding: 0;
          }
        }
      `}</style>
    </>

  )
}

export default Dashboard

