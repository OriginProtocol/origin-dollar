import React, { useEffect, useState } from 'react'
import { useStoreState } from 'pullstate'
import { ethers } from 'ethers'
import { get } from 'lodash'
import { useWeb3React } from '@web3-react/core'

import Layout from 'components/layout'
import Nav from 'components/Nav'
import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import PoolStore from 'stores/PoolStore'
import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math'
import { displayCurrency } from 'utils/math'

const governorAddress = '0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4'

const Dashboard = ({ locale, onLocale }) => {
  const allowances = useStoreState(AccountStore, s => s.allowances)
  const balances = useStoreState(AccountStore, s => s.balances)
  const pools = useStoreState(PoolStore, s => s.pools)

  const account = useStoreState(AccountStore, s => s.address)
  const { chainId } = useWeb3React()

  const { vault, usdt, dai, tusd, usdc, ousd, viewVault, ogn, uniV2OusdUsdt, liquidityOusdUsdt, ognStaking, compensation } = useStoreState(ContractStore, s => s.contracts || {})
  const isMainnetFork = process.env.NODE_ENV === 'development' && chainId === 1
  const isProduction = process.env.NODE_ENV === 'production'
  const isGovernor = account && account === governorAddress
  const [adjusterLocked, setAdjusterLocked] = useState(null)
  const [compensationTotalClaims, setCompensationTotalClaims] = useState('Loading...')

  const updateAdjuster = async () => {
    setAdjusterLocked(await compensation.isAdjusterLocked())
  }

  const loadTotalClaims = async () => {
    setCompensationTotalClaims(
      await displayCurrency(
        await compensation.totalClaims(),
        ousd
      )
    )
  }

  useEffect(() => {
    if (compensation && compensation.provider) {
      updateAdjuster()
      loadTotalClaims()
    }
  }, [compensation])

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

  const sendOUSDToContract = async () => {
    await ousd.transfer(
      compensation.address,
      ethers.utils.parseUnits("20000000", await ousd.decimals())
    )
  }

  const startClaimPeriod = async (seconds) => {
    await compensation.start(seconds)
  }

  const setAdjusterLock = async (lock) => {
    if (lock) {
      await compensation.lockAdjuster()
    } else {
      await compensation.unlockAdjuster()
    }
    await updateAdjuster()
  }

  const mintUSDT = async (multiple) => {
    mintByCommandLineOption()
    await usdt.mint(
      ethers.utils.parseUnits(randomAmount(multiple), await usdt.decimals())
    )
  }

  const mintOGN = async (multiple) => {
    mintByCommandLineOption()
    await ogn.mint(
      ethers.utils.parseUnits(randomAmount(multiple), await ogn.decimals())
    )
  }

  const sendOGNToStakingContract = async () => {
    await ogn.transfer(
      ognStaking.address,
      ethers.utils.parseUnits("1000000", await ogn.decimals())
    )
  }

  const approveStakingToMoveOgn = async () => {
    notSupportedOption()
    await ogn.approve(
      ognStaking.address,
      ethers.constants.MaxUint256
    )
  }

  const approveUSDT = async () => {
    notSupportedOption()
    await usdt.approve(
      vault.address,
      ethers.constants.MaxUint256
    )
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
  }

  const redeemOutputs = async () => {
    const result = await vault.calculateRedeemOutputs(
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

  const approveUSDTForUniswapOUSD_USDT = async () => {
    notSupportedOption()
    await usdt.approve(
      uniV2OusdUsdt.address,
      ethers.constants.MaxUint256
    )
  }

  const approveOUSDForUniswapOUSD_USDT = async () => {
    notSupportedOption()
    await ousd.approve(
      uniV2OusdUsdt.address,
      ethers.constants.MaxUint256
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

  if (process.env.NODE_ENV === 'production') {
    return '';
  }

  return (
    <>
      <Layout locale={locale} onLocale={onLocale} dapp>
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

            <h1 className="mt-5">Staking</h1>
            <table className="table table-bordered">
              <thead>
                <tr>
                  <td>OGN balance</td>
                  <td>{formatCurrency(get(balances, 'ogn'))}</td>
                </tr>
              </thead>
            </table>
            <div className="d-flex flex-wrap">
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintOGN(10000)}>
                Mint hella OGN
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={() => sendOGNToStakingContract()}>
                Supply staking contract with OGN
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={() => approveStakingToMoveOgn()}>
                Approve staking contract to move OGN
              </div>
            </div>

            <>
              <h1 className="mt-5">Compensation</h1>
              <div>Is contract adjuster locked: <b>{adjusterLocked === null ? 'Loading' : adjusterLocked.toString()}</b></div>
              <div>Total claims in the contract: {compensationTotalClaims}</div>
              <div>Below actions can only be started using a governor account. To get that account see the mnemonic in harhat.config.js and fetch the first account</div>
              <div className="d-flex flex-wrap">
                <div className="btn btn-primary my-4 mr-3" onClick={() => setAdjusterLock(true)}>
                  Lock adjuster
                </div>
                <div className="btn btn-primary my-4 mr-3" onClick={() => setAdjusterLock(false)}>
                  Unlock adjuster
                </div>
                <div className="btn btn-primary my-4 mr-3" onClick={() => startClaimPeriod(60)}>
                  Start claim period 1 minute
                </div>
                <div className="btn btn-primary my-4 mr-3" onClick={() => startClaimPeriod(60 * 10)}>
                  Start claim period 10 minutes
                </div>
                <div className="btn btn-primary my-4 mr-3" onClick={() => startClaimPeriod(60 * 60 * 24)}>
                  Start claim period 1 day
                </div>
                <div className="btn btn-primary my-4 mr-3" onClick={() => sendOUSDToContract()}>
                  Send 20m OUSD to contract
                </div>
              </div>
            </>

            <h1 className="mt-5">Liquidity mining</h1>
            {isProduction && <h2>Pool debug information not available in production environment</h2>}
            {!isProduction && pools && pools.map(pool => {
              const lp_token_allowance = Number(pool.lp_token_allowance)
              const lp_token_allowance_unlimited = lp_token_allowance && lp_token_allowance > Number.MAX_SAFE_INTEGER

              return (<div key={pool.name}>
                <h2 className="mt-5">{pool.name} pool</h2>
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <td>Pool stablecoin</td>
                      <td>Balance</td>
                      <td>Allowance</td>
                    </tr>
                  </thead>
                  <tbody>{[pool.coin_one, pool.coin_two].map(coin => {
                    const name = coin.name.toUpperCase()
                    const balance = Number(coin.balance)
                    const allowance = Number(coin.allowance)
                    const unlimited = allowance && allowance > Number.MAX_SAFE_INTEGER

                    return (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>{formatCurrency(balance)}</td>
                        <td>{unlimited ? 'Max' : formatCurrency(allowance)}</td>
                      </tr>
                    )
                  })}</tbody>
                </table>
                <div className="d-flex flex-wrap">
                  {<div
                    className="btn btn-primary my-4 mr-3"
                    disabled={pool.coin_one.name === 'OUSD'}
                    onClick={async () => {
                      if (pool.coin_one.name === 'OUSD'){
                        return 
                      }

                      await pool.coin_one.contract.mint(
                        ethers.utils.parseUnits(randomAmount(100000), await pool.coin_one.contract.decimals())
                      )
                    }}>
                    {pool.coin_one.name !== 'OUSD' && <>Mint Bazillion {pool.coin_one.name}</>}
                    {pool.coin_one.name === 'OUSD' && <>Mint OUSD from the dapp</>}
                  </div>}
                  <div className="btn btn-primary my-4 mr-3" onClick={async () => {
                      await pool.coin_two.contract.mint(
                        ethers.utils.parseUnits(randomAmount(100000), await pool.coin_two.contract.decimals())
                      )
                    }}>
                    Mint Bazillion {pool.coin_two.name} 
                  </div>
                  <div className="btn btn-primary my-4 mr-3" onClick={async () => {
                      await pool.coin_one.contract.approve(
                        pool.lpContract.address,
                        ethers.constants.MaxUint256
                      )
                    }}>
                    Approve {pool.coin_one.name}
                  </div>
                  <div className="btn btn-primary my-4 mr-3" onClick={async () => {
                      await pool.coin_two.contract.approve(
                        pool.lpContract.address,
                        ethers.constants.MaxUint256
                      )
                    }}>
                    Approve {pool.coin_two.name}
                  </div>
                </div>
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <td>Token name</td>
                      <td>user's LP token Balance</td>
                      <td>Pool allowance (of LP token)</td>
                      <td>Staked tokens</td>
                      <td>Unclaimed OGN</td>
                      <td>Your weekly rate</td>
                      <td>Total pool deposits</td>
                      <td>Pool reward per block</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{pool.name}</td>
                      <td>{formatCurrency(pool.lp_tokens)}</td>
                      <td>{lp_token_allowance_unlimited ? 'Max' : formatCurrency(lp_token_allowance)}</td>
                      <td>{formatCurrency(pool.staked_lp_tokens)}</td>
                      <td>{formatCurrency(pool.claimable_ogn)}</td>
                      <td>{formatCurrency(pool.your_weekly_rate)}</td>
                      <td>{formatCurrency(pool.pool_deposits)}</td>
                      <td>{formatCurrency(pool.reward_per_block)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="d-flex flex-wrap">
                  <div className="btn btn-primary my-4 mr-3" onClick={async () => {
                    await pool.lpContract.mint(
                      ethers.utils.parseUnits('1000.0', await pool.lpContract.decimals())
                    ) 
                  }}>
                    Mint LP token
                  </div>
                  <div className="btn btn-primary my-4 mr-3" onClick={async () => {
                    await pool.lpContract.approve(
                      pool.contract.address,
                      ethers.constants.MaxUint256
                    )  
                  }}>
                    Approve LP token (for pool)
                  </div>
                  <div className="btn btn-primary my-4 mr-3" onClick={async () => {
                    await pool.lpContract.decreaseAllowance(
                      pool.contract.address,
                      ethers.utils.parseUnits(pool.lp_token_allowance, await pool.lpContract.decimals())
                    )
                  }}>
                    Clear LP token allowance (for pool)
                  </div>
                  <div className="btn btn-primary my-4 mr-3" onClick={async () => {
                    await pool.contract.deposit(
                      ethers.utils.parseUnits('51.0', await pool.lpContract.decimals())
                    )
                  }}>
                    Stake some LP tokens
                  </div>
                  <div className="btn btn-primary my-4 mr-3" onClick={async () => {
                    await pool.contract.claim()
                  }}>
                    Claim OGN
                  </div>
                </div>
              </div>)
            })}
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

