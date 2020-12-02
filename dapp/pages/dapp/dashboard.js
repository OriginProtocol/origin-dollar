import React from 'react'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'
import { get } from 'lodash'
import { useWeb3React } from '@web3-react/core'

import Layout from 'components/layout'
import Nav from 'components/Nav'
import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math'

const governorAddress = '0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4'

const Dashboard = ({ locale, onLocale }) => {
  const allowances = useStoreState(AccountStore, s => s.allowances)
  const balances = useStoreState(AccountStore, s => s.balances)
  const account = useStoreState(AccountStore, s => s.address)
  const { chainId } = useWeb3React()

  const { vault, usdt, dai, tusd, usdc, ousd, viewVault } = useStoreState(
    ContractStore,
    (s) => s.contracts || {}
  )
  const isMainnetFork = process.env.NODE_ENV === 'development' && chainId === 1
  const isGovernor = account && account === governorAddress

  const randomAmount = (multiple = 0) => {
    return String(Math.floor(Math.random() * (999999 * multiple)) / 100 + 1000)
  }

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

    await usdc.decreaseAllowance(
      vault.address,
      ethers.utils.parseUnits(allowances['usdc'], await usdc.decimals())
    )

    // await tusd.decreaseAllowance(
    //   vault.address,
    //   ethers.utils.parseUnits(allowances['tusd'], await tusd.decimals())
    // )
  }

  const mintUSDT = async (multiple) => {
    mintByCommandLineOption()
    await usdt.mint(
      ethers.utils.parseUnits(randomAmount(multiple), await usdt.decimals())
    )
  }

  const approveUSDT = async () => {
    notSupportedOption()
    await usdt.approve(
      vault.address,
      ethers.constants.MaxUint256
    )
    console.log('debug> dashboard usdt approval')
    AccountStore.update((s) => {
      s.fetchAllowances = 3
    })
  }

  const mintDAI = async (multiple) => {
    mintByCommandLineOption()
    await dai.mint(
      ethers.utils.parseUnits(randomAmount(multiple), await dai.decimals())
    )
  }

  const approveDAI = async () => {
    notSupportedOption()
    await dai.approve(
      vault.address,
      ethers.constants.MaxUint256
    )
    AccountStore.update((s) => {
      s.fetchAllowances = 3
    })
  }

  const mintUSDC = async (multiple) => {
    mintByCommandLineOption()
    await usdc.mint(
      ethers.utils.parseUnits(randomAmount(multiple), await usdc.decimals())
    )
  }

  const approveUSDC = async () => {
    notSupportedOption()
    await usdc.approve(
      vault.address,
      ethers.constants.MaxUint256
    )
    AccountStore.update((s) => {
      s.fetchAllowances = 3
    })
  }

  // const mintTUSD = async (amount) => {
  //   mintByCommandLineOption()
  //   await tusd.mint(
  //     ethers.utils.parseUnits(amount || randomAmount(), await tusd.decimals())
  //   )
  // }

  // const approveTUSD = async () => {
  //   notSupportedOption()
  //   await tusd.approve(
  //     vault.address,
  //     ethers.constants.MaxUint256
  //   )
  // }

  const buyOUSD = async () => {
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

  const unPauseDeposits = async () => {
    notSupportedOption()
    await vault.unpauseDeposits()
  }

  const approveOUSD = async () => {
    notSupportedOption()
    await ousd.approve(
      vault.address,
      ethers.constants.MaxUint256
    )
    AccountStore.update((s) => {
      s.fetchAllowances = 3
    })
  }

  const redeemOutputs = async () => {
    const result = await viewVault.calculateRedeemOutputs(
      ethers.utils.parseUnits(
        "10",
        await ousd.decimals()
      )
    )

    console.log(result)
  }

  const redeemDAI = async () => {
    await vault.redeemAll(dai.address)
  }

  const redeemUSDT = async () => {
    await vault.redeemAll(usdt.address)
  }

  const redeemUSDC = async () => {
    await vault.redeemAll(usdc.address)
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
    return [...Object.keys(currencies), 'ousd'].map((x) => {
      const name = x.toUpperCase()
      const balance = get(balances, x)
      const allowance = Number(get(allowances, x))
      const unlimited = allowance && allowance > Number.MAX_SAFE_INTEGER

      return (
          <tr key={x}>
          <td>{name}</td>
          <td>{unlimited ? 'Unlimited' : (allowance ? 'Some' : 'None')}</td>
          <td>1</td>
          <td>{formatCurrency(balance)}</td>
          <td>{unlimited ? 'Max' : formatCurrency(allowance)}</td>
        </tr>
      )
    })
  }

  return (
    <>
      <Layout locale={locale} dapp>
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
                <p className="card-text">{formatCurrency(get(balances, 'ousd'))} OUSD</p>
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
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintUSDT()}>
                Mint 1,000 USDT
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintUSDT(1)}>
                Mint random USDT
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintUSDT(10000)}>
                Mint hella USDT
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveUSDT}>
                Approve USDT
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={redeemUSDT}>
                Redeem USDT
              </div>
            </div>
            <div className="d-flex flex-wrap">
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintDAI()}>
                Mint 1,000 DAI
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintDAI(1)}>
                Mint random DAI
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintDAI(10000)}>
                Mint hella DAI
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveDAI}>
                Approve DAI
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={redeemDAI}>
                Redeem DAI
              </div>
            </div>
            <div className="d-flex flex-wrap">
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintUSDC()}>
                Mint 1,000 USDC
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintUSDC(1)}>
                Mint random USDC
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintUSDC(10000)}>
                Mint hella USDC
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveUSDC}>
                Approve USDC
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={redeemUSDC}>
                Redeem USDC
              </div>
            </div>
            {/*
            <div className="d-flex flex-wrap">
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintTUSD()}>
                Mint TUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveTUSD}>
                Approve TUSD
              </div>
            </div>
            */}
            <div className="d-flex flex-wrap">
              {isGovernor && (
                <div className="btn btn-primary my-4 mr-3" onClick={depositYield}>
                  Deposit $10 Yield
                </div>
              )}
              <div className="btn btn-primary my-4 mr-3" onClick={clearAllAllowances}>
                Clear All Allowances
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={buyOUSD}>
                Buy OUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={unPauseDeposits}>
                Un-Pause Deposits
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveOUSD}>
                Approve OUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={setupSupportAssets}>
                Support DAI & USDT & USDC
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={redeemOutputs}>
                Calculate Redeem outputs
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

