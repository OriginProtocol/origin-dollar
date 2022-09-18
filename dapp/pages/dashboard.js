import React, { useEffect, useState } from 'react'
import { useStoreState } from 'pullstate'
import { ethers, BigNumber } from 'ethers'
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
import { encodePriceSqrt } from 'utils/uniswapHelper'
import { isProduction } from 'constants/env'

const governorAddress = '0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4'

const Dashboard = ({ locale, onLocale }) => {
  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const balances = useStoreState(AccountStore, (s) => s.balances)
  const pools = useStoreState(PoolStore, (s) => s.pools)

  const account = useStoreState(AccountStore, (s) => s.address)
  const { chainId } = useWeb3React()

  const {
    vault,
    usdt,
    dai,
    tusd,
    usdc,
    ousd,
    viewVault,
    ogn,
    uniV2OusdUsdt,
    liquidityOusdUsdt,
    ognStaking,
    compensation,
    uniV3OusdUsdt,
    uniV3DaiUsdt,
    uniV3UsdcUsdt,
    uniV3NonfungiblePositionManager,
    uniV3SwapRouter,
    flipper,
  } = useStoreState(ContractStore, (s) => s.contracts || {})
  const isMainnetFork = process.env.NODE_ENV === 'development' && chainId === 1
  const isGovernor = account && account === governorAddress
  const [refreshFlipperData, setRefreshFlipperData] = useState(0)
  const [refreshUniV3Data, setRefreshUniV3Data] = useState(0)
  const [flipperData, setFlipperData] = useState({})
  const [uniV3Data, setUniV3Data] = useState({})
  const [adjusterLocked, setAdjusterLocked] = useState(null)
  const [compensationTotalClaims, setCompensationTotalClaims] =
    useState('Loading...')

  const updateAdjuster = async () => {
    setAdjusterLocked(await compensation.isAdjusterLocked())
  }

  const loadTotalClaims = async () => {
    setCompensationTotalClaims(
      await displayCurrency(await compensation.totalClaims(), ousd)
    )
  }

  useEffect(() => {
    if (compensation && compensation.provider) {
      updateAdjuster()
      loadTotalClaims()
    }
  }, [compensation])

  useEffect(() => {
    const refreshDataInterval = setInterval(() => {
      setRefreshFlipperData(refreshFlipperData + Math.random())
      setRefreshUniV3Data(refreshUniV3Data + Math.random())
    }, 4000)

    return () => {
      clearInterval(refreshDataInterval)
    }
  }, [])

  useEffect(() => {
    if (
      !(
        !dai ||
        !dai.provider ||
        !usdc ||
        !usdc.provider ||
        !usdt ||
        !usdt.provider ||
        !ousd ||
        !ousd.provider
      )
    ) {
      const refreshBalances = async () => {
        const daiAmount = await dai.balanceOf(flipper.address)
        const usdtAmount = await usdt.balanceOf(flipper.address)
        const usdcAmount = await usdc.balanceOf(flipper.address)
        const ousdAmount = await ousd.balanceOf(flipper.address)

        const daiAllowance = await displayCurrency(
          await dai.allowance(account, flipper.address),
          dai
        )
        const usdtAllowance = await displayCurrency(
          await usdt.allowance(account, flipper.address),
          usdt
        )
        const usdcAllowance = await displayCurrency(
          await usdc.allowance(account, flipper.address),
          usdc
        )
        const ousdAllowance = await displayCurrency(
          await ousd.allowance(account, flipper.address),
          ousd
        )

        setFlipperData({
          daiBalance: daiAmount,
          usdtBalance: usdtAmount,
          usdcBalance: usdcAmount,
          ousdBalance: ousdAmount,
          daiAllowance: daiAllowance,
          usdtAllowance: usdtAllowance,
          usdcAllowance: usdcAllowance,
          ousdAllowance: ousdAllowance,
        })
      }

      refreshBalances()
    }
  }, [refreshFlipperData, dai, usdc, usdt, ousd])

  useEffect(() => {
    if (
      !(
        !usdt ||
        !usdt.provider ||
        !ousd ||
        !ousd.provider ||
        !uniV3SwapRouter ||
        !uniV3SwapRouter.provider
      )
    ) {
      let usdtAllowanceManager,
        ousdAllowanceManager,
        daiAllowanceManager,
        usdcAllowanceManager = 'Loading'
      const refreshUniswapData = async () => {
        const usdtAllowanceRouter = await displayCurrency(
          await usdt.allowance(account, uniV3SwapRouter.address),
          usdt
        )
        const ousdAllowanceRouter = await displayCurrency(
          await ousd.allowance(account, uniV3SwapRouter.address),
          ousd
        )

        const daiAllowanceRouter = await displayCurrency(
          await dai.allowance(account, uniV3SwapRouter.address),
          usdt
        )
        const usdcAllowanceRouter = await displayCurrency(
          await usdc.allowance(account, uniV3SwapRouter.address),
          ousd
        )

        if (!isProduction) {
          usdtAllowanceManager = await displayCurrency(
            await usdt.allowance(
              account,
              uniV3NonfungiblePositionManager.address
            ),
            usdt
          )
          ousdAllowanceManager = await displayCurrency(
            await ousd.allowance(
              account,
              uniV3NonfungiblePositionManager.address
            ),
            ousd
          )
          daiAllowanceManager = await displayCurrency(
            await dai.allowance(
              account,
              uniV3NonfungiblePositionManager.address
            ),
            dai
          )
          usdcAllowanceManager = await displayCurrency(
            await usdc.allowance(
              account,
              uniV3NonfungiblePositionManager.address
            ),
            usdc
          )
        }

        const usdtBalancePoolousd_usdt = await displayCurrency(
          await usdt.balanceOf(uniV3OusdUsdt.address),
          usdt
        )
        const ousdBalancePoolousd_usdt = await displayCurrency(
          await ousd.balanceOf(uniV3OusdUsdt.address),
          ousd
        )

        const usdtBalancePooldai_usdt = await displayCurrency(
          await usdt.balanceOf(uniV3DaiUsdt.address),
          usdt
        )
        const daiBalancePooldai_usdt = await displayCurrency(
          await dai.balanceOf(uniV3DaiUsdt.address),
          dai
        )

        const usdtBalancePoolusdc_usdt = await displayCurrency(
          await usdt.balanceOf(uniV3UsdcUsdt.address),
          usdt
        )
        const usdcBalancePoolusdc_usdt = await displayCurrency(
          await usdc.balanceOf(uniV3UsdcUsdt.address),
          usdc
        )

        setUniV3Data({
          usdtAllowanceRouter,
          ousdAllowanceRouter,
          daiAllowanceRouter,
          usdcAllowanceRouter,
          usdtAllowanceManager,
          ousdAllowanceManager,
          daiAllowanceManager,
          usdcAllowanceManager,
          usdtBalancePoolousd_usdt,
          ousdBalancePoolousd_usdt,
          usdtBalancePooldai_usdt,
          daiBalancePooldai_usdt,
          usdtBalancePoolusdc_usdt,
          usdcBalancePoolusdc_usdt,
        })
      }

      refreshUniswapData()
    }
  }, [
    refreshUniV3Data,
    usdt,
    ousd,
    uniV3SwapRouter,
    uniV3NonfungiblePositionManager,
  ])

  const randomAmount = (multiple = 0) => {
    return String(
      Math.floor(Math.random() * (999999999 * multiple)) / 100000 + 1000
    )
  }

  const mintByCommandLineOption = () => {
    if (isMainnetFork) {
      alert(
        "To grant stable coins go to project's 'contracts' folder and run 'yarn run grant-stable-coins:fork' "
      )
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
      ethers.utils.parseUnits(allowances['usdt'].vault, await usdt.decimals())
    )

    await dai.decreaseAllowance(
      vault.address,
      ethers.utils.parseUnits(allowances['dai'].vault, await dai.decimals())
    )

    await usdc.decreaseAllowance(
      vault.address,
      ethers.utils.parseUnits(allowances['usdc'].vault, await usdc.decimals())
    )

    await ousd.decreaseAllowance(
      vault.address,
      ethers.utils.parseUnits(allowances['ousd'].vault, await ousd.decimals())
    )
  }

  const sendOUSDToContract = async () => {
    await ousd.transfer(
      compensation.address,
      ethers.utils.parseUnits('20000000', await ousd.decimals())
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

  const sendCoinToFlipper = async (coinContract, amount) => {
    await coinContract.transfer(
      flipper.address,
      ethers.utils.parseUnits(amount.toString(), await coinContract.decimals())
    )

    setRefreshFlipperData(refreshFlipperData + 1)
  }

  const approveFlipper = async (coinContract) => {
    await coinContract.approve(flipper.address, ethers.constants.MaxUint256)
  }

  const swapFlipperUsdtToOusd = async (bnAmount) => {
    await flipper.buyOusdWithUsdt(bnAmount)
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
      ethers.utils.parseUnits('1000000', await ogn.decimals())
    )
  }

  const approveStakingToMoveOgn = async () => {
    notSupportedOption()
    await ogn.approve(ognStaking.address, ethers.constants.MaxUint256)
  }

  const approveUSDT = async () => {
    notSupportedOption()
    await usdt.approve(vault.address, ethers.constants.MaxUint256)
  }

  const mintDAI = async (multiple) => {
    mintByCommandLineOption()
    await dai.mint(
      ethers.utils.parseUnits(randomAmount(multiple), await dai.decimals())
    )
  }

  const approveDAI = async () => {
    notSupportedOption()
    await dai.approve(vault.address, ethers.constants.MaxUint256)
  }

  const mintUSDC = async (multiple) => {
    mintByCommandLineOption()
    await usdc.mint(
      ethers.utils.parseUnits(randomAmount(multiple), await usdc.decimals())
    )
  }

  const approveUSDC = async () => {
    notSupportedOption()
    await usdc.approve(vault.address, ethers.constants.MaxUint256)
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
    await ousd.approve(vault.address, ethers.constants.MaxUint256)
  }

  const redeemOutputs = async () => {
    const result = await vault.calculateRedeemOutputs(
      ethers.utils.parseUnits('10', await ousd.decimals())
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

  const setRedeemFee = async (amount) => {
    await vault.setRedeemFeeBps(ethers.utils.parseUnits(amount.toString(), 0))
  }

  const approveUSDTForUniswapOUSD_USDT = async () => {
    notSupportedOption()
    await usdt.approve(uniV2OusdUsdt.address, ethers.constants.MaxUint256)
  }

  const approveOUSDForUniswapOUSD_USDT = async () => {
    notSupportedOption()
    await ousd.approve(uniV2OusdUsdt.address, ethers.constants.MaxUint256)
  }

  const approveForUniswapV3Router = async (coinContract) => {
    notSupportedOption()
    await coinContract.approve(
      uniV3SwapRouter.address,
      ethers.constants.MaxUint256
    )

    setRefreshUniV3Data(refreshUniV3Data + 1)
  }

  const approveForUniswapV3Manager = async (coinContract) => {
    notSupportedOption()
    await coinContract.approve(
      uniV3NonfungiblePositionManager.address,
      ethers.constants.MaxUint256
    )

    setRefreshUniV3Data(refreshUniV3Data + 1)
  }

  const initializeUniswapV3 = async (contract1, contract2, poolContract) => {
    const sqrtPriceX96 = encodePriceSqrt(
      ethers.utils.parseUnits('1', await contract1.decimals()),
      ethers.utils.parseUnits('1', await contract2.decimals())
    )

    // TODO: This isn't initialized correctly so prices are off, but the transactions still execute

    // console.log('PRICE: ', sqrtPriceX96.toString())
    // the sqrtPriceX96 taken directly from pool creation on mainnet: https://etherscan.io/tx/0xe83eb25244b0e3a5b040f824ac9983cff0bc610747df45bf57755ef7b4bc3c74
    // await uniV3OusdUsdt.initialize(BigNumber.from('79224306130848112672356'))

    await poolContract.initialize(sqrtPriceX96)
  }

  const provideLiquidityV3 = async (contract1, contract2) => {
    // Below part done directly by this periphery contract:
    // https://github.com/Uniswap/uniswap-v3-periphery/blob/9ca9575d09b0b8d985cc4d9a0f689f7a4470ecb7/contracts/base/LiquidityManagement.sol#L80-L86

    // If error 'LOK' is thrown then the pool might have not been initialized
    const result = await uniV3NonfungiblePositionManager.mint([
      contract1.address,
      contract2.address,
      500, // pre-defined Factory fee for stablecoins
      20, // tick lower
      50, // tick upper
      ethers.utils.parseUnits('1000', await contract1.decimals()), // amount0Desired
      ethers.utils.parseUnits('1000', await contract2.decimals()), // amount1Desired
      //ethers.utils.parseUnits('900', 18), // amount0Min
      0,
      0,
      account, // recipient
      BigNumber.from(Date.now() + 10000), // deadline - 10 seconds from now
    ])
  }

  const testUniV3Swap100Coin1to2 = async (contract1, contract2) => {
    // If error 'LOK' is thrown then the pool might have not been initialized
    await uniV3SwapRouter.exactInputSingle([
      contract1.address,
      contract2.address,
      500, // pre-defined Factory fee for stablecoins
      account, // recipient
      BigNumber.from(Date.now() + 10000), // deadline - 10 seconds from now
      ethers.utils.parseUnits('100', await contract1.decimals()), // amountIn
      //ethers.utils.parseUnits('98', await usdt.decimals()), // amountOutMinimum
      0, // amountOutMinimum
      0, // sqrtPriceLimitX96
    ])
  }

  const testUniV3Swap100Coin2to1 = async (contract1, contract2) => {
    // If error 'LOK' is thrown then the pool might have not been initialized
    await uniV3SwapRouter.exactInputSingle([
      contract2.address,
      contract1.address,
      500, // pre-defined Factory fee for stablecoins
      account, // recipient
      BigNumber.from(Date.now() + 2 * 60 * 1000), // deadline - 2 minutes from now
      ethers.utils.parseUnits('100', await contract2.decimals()), // amountIn
      //ethers.utils.parseUnits('98', await usdt.decimals()), // amountOutMinimum
      0, // amountOutMinimum
      0, // sqrtPriceLimitX96
    ])
  }

  const setupSupportAssets = async () => {
    notSupportedOption()
    await vault.supportAsset(dai.address, 'DAI')

    await vault.supportAsset(usdt.address, 'USDT')

    await vault.supportAsset(usdc.address, 'USDC')
  }

  const tableRows = () => {
    return [...Object.keys(currencies), 'ousd'].map((x) => {
      const name = x.toUpperCase()
      const balance = get(balances, x)
      const allowance = Number(get(allowances, `${x}.vault`))
      const unlimited = allowance && allowance > Number.MAX_SAFE_INTEGER

      return (
        <tr key={x}>
          <td>{name}</td>
          <td>{unlimited ? 'Unlimited' : allowance ? 'Some' : 'None'}</td>
          <td>1</td>
          <td>{formatCurrency(balance)}</td>
          <td>{unlimited ? 'Max' : formatCurrency(allowance)}</td>
        </tr>
      )
    })
  }

  const displayPoolInfo = (
    coin1,
    coin2,
    coin1Contract,
    coin2Contract,
    poolContract
  ) => {
    const poolName = coin1.toUpperCase() + '/' + coin2.toUpperCase()
    return (
      <div>
        <h3>{poolName}</h3>
        <table className="table table-bordered">
          <thead>
            <tr>
              <td>Asset</td>
              <td>Router - Allowance</td>
              <td>Liquidity Manger - Allowance </td>
              <td>{poolName} Pool - Balance</td>
            </tr>
          </thead>
          <tbody>
            {[coin1, coin2].map((coin) => {
              const name = coin.toUpperCase()
              const coinToDecimals = {
                usdt: 6,
                usdc: 6,
                dai: 18,
                ousd: 18,
              }
              const allowanceRouter = uniV3Data[`${coin}AllowanceRouter`]
              const allowanceManager = uniV3Data[`${coin}AllowanceManager`]
              const poolBalance =
                uniV3Data[`${coin}BalancePool${coin1}_${coin2}`]

              return (
                <tr key={name}>
                  <td>{name}</td>
                  <td>
                    {allowanceRouter
                      ? allowanceRouter === '0.0'
                        ? allowanceRouter
                        : 'Max'
                      : 'Loading'}
                  </td>
                  <td>
                    {allowanceManager
                      ? allowanceManager === '0.0'
                        ? allowanceManager
                        : 'Max'
                      : 'Loading'}
                  </td>
                  <td>{poolBalance}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="d-flex flex-wrap">
          <div
            className="btn btn-primary my-4 mr-3"
            onClick={() =>
              initializeUniswapV3(coin1Contract, coin2Contract, poolContract)
            }
          >
            Initialize Pool
          </div>
          <div
            className="btn btn-primary my-4 mr-3"
            onClick={() => provideLiquidityV3(coin1Contract, coin2Contract)}
          >
            Provide Liquidity
          </div>
          <div
            className="btn btn-primary my-4 mr-3"
            onClick={() =>
              testUniV3Swap100Coin1to2(coin1Contract, coin2Contract)
            }
          >
            Test Uniswap 100 {coin1}
          </div>
          <div
            className="btn btn-primary my-4 mr-3"
            onClick={() =>
              testUniV3Swap100Coin2to1(coin1Contract, coin2Contract)
            }
          >
            Test Uniswap 100 {coin2}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Layout locale={locale} onLocale={onLocale} dapp>
        <Nav dapp locale={locale} onLocale={onLocale} />
        <div className="my-5">
          {!account && <h1 className="text-white">No account :(</h1>}
          {account && (
            <>
              <h1>Balances</h1>
              <div className="card w25 mb-4">
                <div className="card-body">
                  <h5 className="card-title">Current Balance</h5>
                  <p className="card-text">
                    {formatCurrency(get(balances, 'ousd'))} OUSD
                  </p>
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
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => mintUSDT()}
                >
                  Mint 1,000 USDT
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => mintUSDT(1)}
                >
                  Mint random USDT
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => mintUSDT(10000)}
                >
                  Mint hella USDT
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={approveUSDT}
                >
                  Approve USDT
                </div>
                <div className="btn btn-primary my-4 mr-3" onClick={redeemUSDT}>
                  Redeem USDT
                </div>
              </div>
              <div className="d-flex flex-wrap">
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => mintDAI()}
                >
                  Mint 1,000 DAI
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => mintDAI(1)}
                >
                  Mint random DAI
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => mintDAI(10000)}
                >
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
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => mintUSDC()}
                >
                  Mint 1,000 USDC
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => mintUSDC(1)}
                >
                  Mint random USDC
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => mintUSDC(10000)}
                >
                  Mint hella USDC
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={approveUSDC}
                >
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
                  <div
                    className="btn btn-primary my-4 mr-3"
                    onClick={depositYield}
                  >
                    Deposit $10 Yield
                  </div>
                )}
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={clearAllAllowances}
                >
                  Clear All Allowances
                </div>
                <div className="btn btn-primary my-4 mr-3" onClick={buyOUSD}>
                  Buy OUSD
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={unPauseDeposits}
                >
                  Un-Pause Deposits
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={approveOUSD}
                >
                  Approve OUSD
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={setupSupportAssets}
                >
                  Support DAI & USDT & USDC
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={redeemOutputs}
                >
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
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => mintOGN(10000)}
                >
                  Mint hella OGN
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => sendOGNToStakingContract()}
                >
                  Supply staking contract with OGN
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => approveStakingToMoveOgn()}
                >
                  Approve staking contract to move OGN
                </div>
              </div>

              <h1 className="mt-5">Compensation</h1>
              <div>
                Is contract adjuster locked:{' '}
                <b>
                  {adjusterLocked === null
                    ? 'Loading'
                    : adjusterLocked.toString()}
                </b>
              </div>
              <div>Total claims in the contract: {compensationTotalClaims}</div>
              <div>
                Below actions can only be started using a governor account. To
                get that account see the mnemonic in harhat.config.js and fetch
                the first account
              </div>
              <h1 className="mt-5">Flipper</h1>
              <div>
                <div className="mb-2">Balance of coins on Flipper contract</div>
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <td>Asset</td>
                      <td>Balance</td>
                      <td>Allowance</td>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Object.keys(currencies), 'ousd'].map((coin) => {
                      const name = coin.toUpperCase()

                      const coinToDecimals = {
                        usdt: 6,
                        dai: 18,
                        ousd: 18,
                        usdc: 6,
                      }

                      const flipperBalance = flipperData[`${coin}Balance`]
                      const flipperAllowance = flipperData[`${coin}Allowance`]
                      return (
                        <tr key={name}>
                          <td>{name}</td>
                          <td>
                            {flipperBalance
                              ? formatCurrency(
                                  ethers.utils.formatUnits(
                                    flipperBalance,
                                    coinToDecimals[coin]
                                  )
                                )
                              : 'Loading'}
                          </td>
                          <td>
                            {flipperAllowance
                              ? flipperAllowance === '0.0'
                                ? flipperAllowance
                                : 'Max'
                              : 'Loading'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div>
                  Make sure you have stablecoin funds available on your wallet
                  before transfering
                  <div className="d-flex flex-wrap">
                    <div
                      className="btn btn-primary my-4 mr-3"
                      onClick={() => sendCoinToFlipper(usdt, 1000)}
                    >
                      Fund with 1,000 USDT
                    </div>
                    <div
                      className="btn btn-primary my-4 mr-3"
                      onClick={() => sendCoinToFlipper(usdt, 100000)}
                    >
                      Fund with 100,000 USDT
                    </div>
                    <div
                      className="btn btn-primary my-4 mr-3"
                      onClick={() => sendCoinToFlipper(dai, 1000)}
                    >
                      Fund with 1,000 DAI
                    </div>
                    <div
                      className="btn btn-primary my-4 mr-3"
                      onClick={() => sendCoinToFlipper(dai, 100000)}
                    >
                      Fund with 100,000 DAI
                    </div>
                  </div>
                  <div className="d-flex flex-wrap">
                    <div
                      className="btn btn-primary my-4 mr-3"
                      onClick={() => sendCoinToFlipper(usdc, 1000)}
                    >
                      Fund with 1,000 USDC
                    </div>
                    <div
                      className="btn btn-primary my-4 mr-3"
                      onClick={() => sendCoinToFlipper(usdc, 100000)}
                    >
                      Fund with 100,000 USDC
                    </div>
                    <div
                      className="btn btn-primary my-4 mr-3"
                      onClick={() => sendCoinToFlipper(ousd, 1000)}
                    >
                      Fund with 1,000 OUSD
                    </div>
                    <div
                      className="btn btn-primary my-4 mr-3"
                      onClick={() => sendCoinToFlipper(ousd, 100000)}
                    >
                      Fund with 100,000 OUSD
                    </div>
                  </div>
                  <div className="d-flex flex-wrap">
                    <div
                      className="btn btn-primary my-4 mr-3"
                      onClick={() => approveFlipper(ousd)}
                    >
                      Approve OUSD
                    </div>
                    <div
                      className="btn btn-primary my-4 mr-3"
                      onClick={() => approveFlipper(usdt)}
                    >
                      Approve USDT
                    </div>
                    <div
                      className="btn btn-primary my-4 mr-3"
                      onClick={() => approveFlipper(usdc)}
                    >
                      Approve USDC
                    </div>
                    <div
                      className="btn btn-primary my-4 mr-3"
                      onClick={() => approveFlipper(dai)}
                    >
                      Approve DAI
                    </div>
                    {/* Flipper uses amounts denominated in 1e18 */}
                    <div
                      className="btn btn-primary my-4 mr-3"
                      onClick={() =>
                        swapFlipperUsdtToOusd(ethers.utils.parseUnits('1', 18))
                      }
                    >
                      Swap 1 USDT for OUSD
                    </div>
                  </div>
                </div>
              </div>
              <h1 className="mt-5">Uniswap V3</h1>
              <h3 className="mt-5">
                Router and Liquidity manager general actions:
              </h3>
              <div className="d-flex flex-wrap">
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => approveForUniswapV3Router(usdt)}
                >
                  Approve USDT Router
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => approveForUniswapV3Router(ousd)}
                >
                  Approve OUSD Router
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => approveForUniswapV3Router(usdc)}
                >
                  Approve USDC Router
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => approveForUniswapV3Router(dai)}
                >
                  Approve DAI Router
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => approveForUniswapV3Manager(usdt)}
                >
                  Approve USDT Manager
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => approveForUniswapV3Manager(ousd)}
                >
                  Approve OUSD Manager
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => approveForUniswapV3Manager(usdc)}
                >
                  Approve USDC Manager
                </div>
                <div
                  className="btn btn-primary my-4 mr-3"
                  onClick={() => approveForUniswapV3Manager(dai)}
                >
                  Approve DAI Manager
                </div>
              </div>
              {displayPoolInfo('ousd', 'usdt', ousd, usdt, uniV3OusdUsdt)}
              {displayPoolInfo('dai', 'usdt', dai, usdt, uniV3DaiUsdt)}
              {displayPoolInfo('usdc', 'usdt', usdc, usdt, uniV3UsdcUsdt)}
              {!isProduction && (
                <>
                  <h1 className="mt-5">Utils</h1>
                  <div>
                    <div className="d-flex flex-wrap">
                      <div
                        className="btn btn-primary my-4 mr-3"
                        onClick={() => setRedeemFee(50)}
                      >
                        Set redeemFee on Vault to 0.5%
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <h1 className="mt-5">Liquidity mining</h1>
        {isProduction && (
          <h2>
            Pool debug information not available in production environment
          </h2>
        )}
        {!isProduction &&
          pools &&
          pools.map((pool) => {
            const lp_token_allowance = Number(pool.lp_token_allowance)
            const lp_token_allowance_unlimited =
              lp_token_allowance && lp_token_allowance > Number.MAX_SAFE_INTEGER

            return (
              <div key={pool.name}>
                <h2 className="mt-5">{pool.name} pool</h2>
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <td>Pool stablecoin</td>
                      <td>Balance</td>
                      <td>Allowance</td>
                    </tr>
                  </thead>
                  <tbody>
                    {[pool.coin_one, pool.coin_two].map((coin) => {
                      const name = coin.name.toUpperCase()
                      const balance = Number(coin.balance)
                      const allowance = Number(coin.allowance)
                      const unlimited =
                        allowance && allowance > Number.MAX_SAFE_INTEGER

                      return (
                        <tr key={name}>
                          <td>{name}</td>
                          <td>{formatCurrency(balance)}</td>
                          <td>
                            {unlimited ? 'Max' : formatCurrency(allowance)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="d-flex flex-wrap">
                  {
                    <div
                      className="btn btn-primary my-4 mr-3"
                      disabled={pool.coin_one.name === 'OUSD'}
                      onClick={async () => {
                        if (pool.coin_one.name === 'OUSD') {
                          return
                        }

                        await pool.coin_one.contract.mint(
                          ethers.utils.parseUnits(
                            randomAmount(100000),
                            await pool.coin_one.contract.decimals()
                          )
                        )
                      }}
                    >
                      {pool.coin_one.name !== 'OUSD' && (
                        <>Mint Bazillion {pool.coin_one.name}</>
                      )}
                      {pool.coin_one.name === 'OUSD' && (
                        <>Mint OUSD from the dapp</>
                      )}
                    </div>
                  }
                  <div
                    className="btn btn-primary my-4 mr-3"
                    onClick={async () => {
                      await pool.coin_two.contract.mint(
                        ethers.utils.parseUnits(
                          randomAmount(100000),
                          await pool.coin_two.contract.decimals()
                        )
                      )
                    }}
                  >
                    Mint Bazillion {pool.coin_two.name}
                  </div>
                  <div
                    className="btn btn-primary my-4 mr-3"
                    onClick={async () => {
                      await pool.coin_one.contract.approve(
                        pool.lpContract.address,
                        ethers.constants.MaxUint256
                      )
                    }}
                  >
                    Approve {pool.coin_one.name}
                  </div>
                  <div
                    className="btn btn-primary my-4 mr-3"
                    onClick={async () => {
                      await pool.coin_two.contract.approve(
                        pool.lpContract.address,
                        ethers.constants.MaxUint256
                      )
                    }}
                  >
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
                      <td>
                        {lp_token_allowance_unlimited
                          ? 'Max'
                          : formatCurrency(lp_token_allowance)}
                      </td>
                      <td>{formatCurrency(pool.staked_lp_tokens)}</td>
                      <td>{formatCurrency(pool.claimable_ogn)}</td>
                      <td>{formatCurrency(pool.your_weekly_rate)}</td>
                      <td>{formatCurrency(pool.pool_deposits)}</td>
                      <td>{formatCurrency(pool.reward_per_block)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="d-flex flex-wrap">
                  <div
                    className="btn btn-primary my-4 mr-3"
                    onClick={async () => {
                      await pool.lpContract.mint(
                        ethers.utils.parseUnits(
                          '1000.0',
                          await pool.lpContract.decimals()
                        )
                      )
                    }}
                  >
                    Mint LP token
                  </div>
                  <div
                    className="btn btn-primary my-4 mr-3"
                    onClick={async () => {
                      await pool.lpContract.approve(
                        pool.contract.address,
                        ethers.constants.MaxUint256
                      )
                    }}
                  >
                    Approve LP token (for pool)
                  </div>
                  <div
                    className="btn btn-primary my-4 mr-3"
                    onClick={async () => {
                      await pool.lpContract.decreaseAllowance(
                        pool.contract.address,
                        ethers.utils.parseUnits(
                          pool.lp_token_allowance,
                          await pool.lpContract.decimals()
                        )
                      )
                    }}
                  >
                    Clear LP token allowance (for pool)
                  </div>
                  <div
                    className="btn btn-primary my-4 mr-3"
                    onClick={async () => {
                      await pool.contract.deposit(
                        ethers.utils.parseUnits(
                          '51.0',
                          await pool.lpContract.decimals()
                        )
                      )
                    }}
                  >
                    Stake some LP tokens
                  </div>
                  <div
                    className="btn btn-primary my-4 mr-3"
                    onClick={async () => {
                      await pool.contract.claim()
                    }}
                  >
                    Claim OGN
                  </div>
                </div>
              </div>
            )
          })}
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
