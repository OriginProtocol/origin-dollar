import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import withRpcProvider from 'hoc/withRpcProvider'
import ethers from 'ethers'
import dateformat from 'dateformat'

import withIsMobile from 'hoc/withIsMobile'
import Layout from 'components/layout'
import Nav from 'components/Nav'
import ContractStore from 'stores/ContractStore'
import StakeStore from 'stores/StakeStore'
import AccountStore from 'stores/AccountStore'
import SummaryHeaderStat from 'components/earn/SummaryHeaderStat'
import StakeBoxBig from 'components/earn/StakeBoxBig'
import CurrentStakeLockup from 'components/earn/CurrentStakeLockup'
import EtherscanLink from 'components/earn/EtherscanLink'
import ClaimModal from 'components/earn/modal/ClaimModal'
import { formatCurrency } from 'utils/math'
import { sleep } from 'utils/utils'
import { enrichStakeData, durationToDays, formatRate } from 'utils/stake'
import StakeModal from 'components/earn/modal/StakeModal'
import StakeDetailsModal from 'components/earn/modal/StakeDetailsModal'
import SpinningLoadingCircle from 'components/SpinningLoadingCircle'
import { refetchUserData } from 'utils/account'
import { addStakeTxHashToWaitingBuffer } from 'utils/stake'


const Stake = ({ locale, onLocale, rpcProvider, isMobile }) => {
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [showStakeModal, setShowStakeModal] = useState(false)
  const [showStakeDetails, setShowStakeDetails] = useState(null)
  const [selectedDuration, setSelectedDuration] = useState(false)
  const [stakeOptions, setStakeOptions] = useState([])
  const [selectedRate, setSelectedRate] = useState(false)
  const [error, setError] = useState(null)
  const [waitingForClaimTx, setWaitingForClaimTx] = useState(false)
  const [waitingForStakeTx, setWaitingForStakeTx] = useState(false)
  const [waitingForStakeTxDuration, setWaitingForStakeTxDuration] = useState(false)
  const { ogn: ognBalance } = useStoreState(AccountStore, (s) => s.balances)
  const [stakes, setStakes] = useState(null)
  const [nonClaimedActiveStakes, setNonClaimedActiveStakes] = useState(null)
  const [pastStakes, setPastStakes] = useState(null)
  const [vestedStakes, setVestedStakes] = useState(null)
  const [ognToClaim, setOgnToClaim] = useState(null)
  const isLocalEnvironment = process.env.NODE_ENV === 'development'
  const [totalCurrentInterest, setTotalCurrentInterest] = useState(0)

  const { totalPrincipal, ognAllowance, durations, rates, stakes: rawStakes } = useStoreState(
    StakeStore,
    (s) => s
  )

  const formatBn = (amount, decimals) => {
    return ethers.utils.formatUnits(amount, decimals)
  }

  const recalculateStakeData = () => {
    if (rawStakes !== null) {
      const stakes = rawStakes.map(rawStake => {
        const stake = {
          rate: formatBn(rawStake.rate, 18),
          amount: formatBn(rawStake.amount, 18),
          end: formatBn(rawStake.end, 0),
          duration: formatBn(rawStake.duration, 0),
          paid: rawStake.paid
        }

        if (rawStake.hash) {
          stake.hash = rawStake.hash
        }

        if (rawStake.claimHash) {
          stake.claimHash = rawStake.claimHash
        }

        return stake
      })
      .map(stake => enrichStakeData(stake))

      const nonClaimedActiveStakes = stakes.filter(stake => !stake.paid)
      const pastStakes = stakes.filter(stake => stake.paid)
      const vestedStakes = nonClaimedActiveStakes
        .filter(stake => stake.hasVested)
      const ognToClaim = vestedStakes
        .map(stake => stake.total).reduce((a, b) => a+b, 0)

      setTotalCurrentInterest(nonClaimedActiveStakes
        .map(stake => stake.interestAccrued)
        .reduce((i1, i2) => i1 + i2, 0)
      )
      setStakes(stakes)
      setNonClaimedActiveStakes(nonClaimedActiveStakes)
      setPastStakes(pastStakes)
      setVestedStakes(vestedStakes)
      setOgnToClaim(ognToClaim)
    }
  }

  useEffect(() => {
    recalculateStakeData()
  }, [rawStakes])

  let recalculateInterval
  /* Raw stake data doesn't change if no new stakes are added / removed, only the derived/calculated
   * stake data changes. For that reason we are manually recalculating the stake data every 
   * half a second.
   */
  useEffect(() => {
    recalculateInterval = setInterval(() => {
      recalculateStakeData()
    }, 500)
    
    return () => {
      clearInterval(recalculateInterval)
    }
  }, [rawStakes])

  const { ognStaking, ogn: ognContract } = useStoreState(
    ContractStore,
    (s) => {
      if (s.contracts) {
        return s.contracts
      }
      return {}
    }
  )
  const stakesEmpty = stakes && stakes.length === 0

  const toFriendlyError = (error) => {
    let message = error.message ? error.message : ''
    if (error.data && error.data.message) {
      message += ' ' + error.data.message.toLowerCase()
    }

    // ignore user denied transactions
    if (message.includes('User denied transaction')) {
      return null
    }

    if (message.includes('insufficient rewards')) {
      return fbt('Staking contract has insufficient OGN funds', 'Insufficient funds error message')
    } else if (message.includes('all stakes in lock-up')) {
      return fbt('All of the stakes are still in lock-up', 'All stakes in lock up error message')
    } 
    else {
      return fbt('Unexpected error happened', 'Unexpected error happened')
    }
  }

  useEffect(() => {
    if (rates && durations && rates.length > 0 && durations.length > 0) {
      setStakeOptions([
        {
          rate: formatBn(rates[0], 18),
          duration: formatBn(durations[0], 0),
          durationBn: durations[0],
          subtitle: fbt('Flexible, steady income', 'Flexible, steady income')
        },
        {
          rate: formatBn(rates[1], 18),
          duration: formatBn(durations[1], 0),
          durationBn: durations[1],
          subtitle: fbt('Best balance', 'Best balance')
        },
        {
          rate: formatBn(rates[2], 18),
          duration: formatBn(durations[2], 0),
          durationBn: durations[2],
          subtitle: fbt('Most popular, high-yield', 'Most popular, high-yield')
        }
      ])
    }
  }, [durations, rates])

  const onStakeModalClick = (duration, rate) => {
    setSelectedDuration(duration)
    setSelectedRate(rate)
    setError(null)
    setShowStakeModal(true)
  }

  return process.env.ENABLE_STAKING === 'true' && <>
    {showStakeDetails && <StakeDetailsModal
      stake={showStakeDetails}
      onClose={(e) => {
        setShowStakeDetails(null)
      }}
    />}
    {showStakeModal && (
      <StakeModal
        tokenAllowanceSuffiscient={
          Number(ognAllowance) > Number.MAX_SAFE_INTEGER
        }
        tokenToStakeDecimalsCall={ognContract.decimals}
        stakeFunctionCall={async (stakeAmount) => {
          return ognStaking.stake(stakeAmount, selectedDuration)
        }}
        stakeTokenBalance={ognBalance}
        stakeTokenName="OGN"
        contractApprovingTokenUsage={ognContract}
        contractAllowedToMoveTokens={ognStaking}
        stakeButtonText={fbt('Stake', 'Stake')}
        selectTokensAmountTitle={fbt(
          fbt.param('Stake rate', formatRate(selectedRate)) + '% - ' + fbt.param('Duration in days', durationToDays(selectedDuration * 1000)) + ' days',
          'Selected duration and staking rate'
        )}
        approveTokensTitle={fbt('Approve & stake', 'Approve & stake')}
        availableToDepositSymbol="OGN"
        tokenIconAndName={<div className="d-flex align-items-center">
          <img className="coin-icon" src="/images/ogn-icon-blue.svg" />
          <div className="coin-name">
            OGN
          </div>
        </div>}
        tokenIcon={<div className="d-flex align-items-center">
          <img className="coin-icon" src="/images/ogn-icon-blue.svg" />
        </div>}
        permissionToUseTokensText={fbt(
          'Permission to use OGN token',
          'Permission to use OGN token'
        )}
        onClose={(e) => {
          setShowStakeModal(false)
        }}
        onUserConfirmedStakeTx={async (result, data) => {
          setWaitingForStakeTx(true)
          setWaitingForStakeTxDuration(selectedDuration)
          // just to make the loading circle on the button noticable in local dev
          if (isLocalEnvironment) {
            await sleep(3000)
          }

          // add hash to a list to be able to match it with stake info returned by the contract
          addStakeTxHashToWaitingBuffer(result.hash, formatBn(data.stakeAmount, 18), selectedDuration)
          const receipt = await rpcProvider.waitForTransaction(result.hash)
          setWaitingForStakeTx(false)
          setWaitingForStakeTxDuration(false)
          refetchUserData()
        }}
        onError={(e) => {
          setError(toFriendlyError(e))
        }}
        className="wider-stake-input"
      />
    )}
    {showClaimModal && (
      <ClaimModal
        onClose={(e) => {
          setShowClaimModal(false)
        }}
        onClaimContractCall={ognStaking.exit}
        ognToClaim={ognToClaim}
        onUserConfirmedClaimTx={async (result) => {
          setWaitingForClaimTx(true)
          // just to make the loading circle on the button noticable in local dev
          if (isLocalEnvironment) {
            await sleep(3000)
          }
          
          vestedStakes.forEach(stake => {
            // add claim hash to all the vested stakes. That will be stored to local storage and added to contract data
            addStakeTxHashToWaitingBuffer(result.hash, stake.amount, formatCurrency(stake.duration / 1000, 1), stake.end, true)
          }) 

          const receipt = await rpcProvider.waitForTransaction(result.hash)
          setWaitingForClaimTx(false)
          refetchUserData()
        }}
        onError={(e) => {
          setError(toFriendlyError(e))
        }}
      />
    )}
    <Layout onLocale={onLocale} locale={locale} dapp>
      <Nav
        dapp
        page={'stake'}
        locale={locale}
        onLocale={onLocale}
      />
      <div className="home d-flex flex-column">
        <div className="d-flex flex-column flex-md-row">
          <div className="stat-holder col-12 col-md-6 pl-md-0 pr-md-10">
            <SummaryHeaderStat
              title={fbt('Total Principal', 'Total Principal')}
              value={parseFloat(totalPrincipal) === 0 ? 0 : formatCurrency(totalPrincipal, 6)}
              valueAppend="OGN"
              className="w-100"
            />
          </div>
          <div className="stat-holder col-12 col-md-6 pr-md-0 pl-md-10">
            <SummaryHeaderStat
              title={fbt('Total Interest', 'Total Interest')}
              value={parseFloat(totalCurrentInterest) === 0 ? 0 : formatCurrency(totalCurrentInterest, 6)}
              valueAppend="OGN"
              className="w-100"
            />
          </div>
        </div>
        {stakesEmpty && <div className="no-stakes-box d-flex">
          <img className="big-ogn-icon" src="/images/ogn-icon-large.svg" />
          <div className="d-flex flex-column justify-content-center">
            <div className="title-text">{fbt('Get started with staking by selecting a lock-up period', 'Empty stakes title')}</div>
            <div className="text">{fbt('You will be able to claim your OGN principal plus interest at the end of the staking period.', 'Empty stakes message')}</div>
          </div>
        </div>}
        {(stakes === null || stakeOptions.length === 0) && <div className="loading-text">
          {fbt('Loading...', 'Loading...')}
        </div>} 
        {stakeOptions.length > 0 &&  <div className="d-flex flex-column lockup-options">
          <div className={`title available-lockups ${stakesEmpty ? 'grey' : ''}`}>{fbt('Available Lockups', 'Available Lockups')}</div>
          <div className="d-flex stake-options flex-column flex-md-row">
            {stakeOptions.map(stakeOption => {
              const waitingFormattedDuration = waitingForStakeTxDuration ? formatBn(waitingForStakeTxDuration, 0) : false
              return (
                <div 
                  key={stakeOption.duration}
                  className="col-12 col-md-4"
                >
                  <StakeBoxBig
                    percentage={stakeOption.rate}
                    duration={durationToDays(stakeOption.duration * 1000)}
                    onClick={e => {
                      onStakeModalClick(stakeOption.durationBn, stakeOption.rate)
                    }}
                    subtitle={stakeOption.subtitle}
                    showLoadingWheel={waitingForStakeTx && waitingFormattedDuration === stakeOption.duration}
                  />
                </div>
              )
            })}
          </div>
        </div>}
        {error && <div className="error-box d-flex align-items-center justify-content-center">
          {error}
        </div>}
        {nonClaimedActiveStakes && nonClaimedActiveStakes.length > 0 && <div className="d-flex flex-column current-lockups">
          <div className="title dark">{fbt('Current Lockups', 'Current Lockups')}</div>
          {nonClaimedActiveStakes.map(stake => {
            return <CurrentStakeLockup
              key={stake.end}
              stake={stake}
              onDetailsClick={(e) => {
                setShowStakeDetails(stake)
              }}
            />
          })}
          <div className="claim-button-holder d-flex align-items-center justify-content-center">
            <button 
              className="btn-dark"
              disabled={!vestedStakes || vestedStakes.length === 0}
              onClick={e => {
                /* We don't want to visually disable the button when waitingForClaimTx is true
                 * because the loading spinner isn't evident then. For that reason we still keep it
                 * visibly enabled, but disable the functionality in onClick
                 */
                if (waitingForClaimTx) {
                  return
                }

                setError(null)
                setShowClaimModal(true)
              }}
            >
              {!waitingForClaimTx && fbt('Claim OGN', 'Claim OGN')}
              {waitingForClaimTx && (
                <SpinningLoadingCircle backgroundColor="183140" />
              )}
            </button>
          </div>
        </div>}
        {pastStakes && pastStakes.length > 0 && <div className="d-flex flex-column previous-lockups">
          <div className="title dark">{fbt('Previous Lockups', 'Previous Lockups')}</div>
          <table>
              <thead>
                <tr key="table-head">
                  <td>{fbt('APY', 'APY')}</td>
                  {!isMobile && <>
                    <td>{fbt('Duration', 'Duration')}</td>
                    <td>{fbt('Maturity', 'Maturity')}</td>
                    <td>{fbt('Principal', 'Principal')}</td>
                  </>}
                  <td>{fbt('Interest', 'Interest')}</td>
                  <td>{fbt('Total', 'Total')}</td>
                </tr>
              </thead>
              <tbody>{pastStakes.map(stake => {
                const ognDecimals = isMobile ? 2 : 6
                return <tr key={stake.end}>
                  <td>{formatRate(stake.rate)}%</td>
                  {!isMobile && <>
                    <td>{fbt(fbt.param('number_of_days', stake.durationDays) + ' days', 'duration in days')}</td>
                    <td>{dateformat(new Date(stake.end), 'mm/dd/yyyy')}</td>
                    <td>{formatCurrency(stake.amount, ognDecimals)}</td>
                  </>}
                  <td>{formatCurrency(stake.interest, ognDecimals)}</td>
                  <td>
                    <div className="modal-details-button d-flex align-items-center justify-content-between">
                      <div>{formatCurrency(stake.total, ognDecimals)}</div>
                      <div
                        className="modal-link d-flex align-items-center justify-content-center"
                        onClick={() => {
                          setShowStakeDetails(stake)
                        }}
                      >
                        <img className="caret-left" src="/images/caret-left-grey.svg" />
                        <img className="caret-left hover" src="/images/caret-left.svg" />
                      </div>
                    </div>
                  </td>
                </tr>
              })}
              </tbody>
            </table>
        </div>}
        {ognStaking && <div className="d-flex justify-content-center mt-50">
          <EtherscanLink
            href={`https://etherscan.io/address/${ognStaking.address}`}
            text={fbt('OGN Staking Contract', 'OGN Staking Contract')}
          />
        </div>}
      </div>
    </Layout>
    <style jsx>{`
      .home {
        padding-top: 80px;
      }

      .pr-10 {
        padding-right: 10px!important;
      }

      .pl-10 {
        padding-left: 10px!important;
      }

      .title {
        margin-top: 50px;
        margin-bottom: 23px;
        font-family: Lato;
        font-size: 14px;
        font-weight: bold;
        color: white;
      }

      .previous-lockups .title {
        margin-bottom: 10px;
      }

      .title.grey {
        color: #8293a4;
      }

      .title.dark {
        color: #183140;
      }

      .mt-50 {
        margin-top: 50px;
      }

      .btn-dark {
        background-color: #385160;
        height: 50px;
      }

      .claim-button-holder {
        width: 100%;
        height: 80px;
        border-radius: 10px;
        border: solid 1px #cdd7e0;
        background-color: #f2f3f5;
      }

      .previous-lockups table thead {
        font-size: 14px;
        color: #576c7a;
      }

      .previous-lockups table tbody {
        font-size: 14px;
        color: black;
      }

      .previous-lockups table tr {
        height: 52px;
        border-bottom: solid 1px #e4e4e4;
      }

      .previous-lockups table td {
        min-width: 100px;
      }

      .coin-icon {
        width: 30px;
        height: 30px;
        min-width: 30px;
        min-height: 30px;
        position: relative;
        z-index: 1;
      }

      .coin-name {
        margin-left: 10px;
        font-size: 14px;
        color: #8293a4;
      }

      .stake-options div:first-child {
        padding-left: 0px!important;
        padding-right: 10px!important;
      }

      .stake-options div:last-child {
        padding-left: 10px!important;
        padding-right: 0px!important;
      }

      .stake-options div:not(:first-child):not(:last-child) {
        padding-left: 10px!important;
        padding-right: 10px!important;
      }

      .error-box {
        font-size: 14px;
        line-height: 1.36;
        text-align: center;
        color: #183140;
        border-radius: 5px;
        border: solid 1px #ed2a28;
        background-color: #fff0f0;
        height: 50px;
        min-width: 320px;
        margin-top: 50px;
      }

      .modal-link {
        width: 30px;
        height: 30px;
        border-radius: 15px;
        font-family: material;
        font-size: 14px;
        text-align: right;
        padding: 10px;
        cursor: pointer;
        color: #8293a4;
        background-color: transparent;
      }

      .modal-details-button:hover .modal-link {
        color: white;
        background-color: #cdd7e0;
      }

      .loading-text {
        font-size: 35px;
        color: white;
        margin-top: 30px;
        margin-bottom: 30px;
      }

      .no-stakes-box {
        height: 200px;
        width: 100%;
        padding: 40px;
        background-image: radial-gradient(circle at 10% 50%, rgba(255, 255, 255, 0.4), rgba(26, 130, 240, 0) 25%);
        background-color: #1a82ff;
        border-radius: 10px;
        margin-top: 20px;
      }

      .no-stakes-box .title-text {
        font-size: 24px;
        font-weight: bold;
        line-height: 1.75;
        color: white;
      }

      .no-stakes-box .text {
        opacity: 0.8;
        color: white;
        line-height: normal;
        font-size: 18px;
        max-width: 524px;
      }

      .no-stakes-box .big-ogn-icon {
        margin-right: 35px;
      }

      .caret-left {
        transform: rotate(180deg);
        width: 7px;
        height: 14px;
      }

      .modal-details-button .caret-left.hover {
        display: none;
      }

      .modal-details-button:hover .caret-left.hover {
        display: block;
      }

      .modal-details-button:hover .caret-left {
        display: none;
      }

      @media (min-width: 768px) {
        .pr-md-10 {
          padding-right: 10px!important;
        }
        
        .pl-md-10 {
          padding-left: 10px!important;
        }
      }

      @media (max-width: 799px) {
        .home {
          padding: 0;
          padding-left: 20px;
          padding-right: 20px;
        }

        .stat-holder {
          padding-left: 0px;
          padding-right: 0px;
          margin-bottom: 20px;
        }

        .available-lockups {
          margin-top: 20px;
        }

        .stake-options div:last-child,
        .stake-options div:first-child,
        .stake-options div:not(:first-child):not(:last-child) {
          padding-left: 0px!important;
          padding-right: 0px!important;
          margin-bottom: 20px;
        }
      }
    `}</style>
  </>
}

export default withIsMobile(withRpcProvider(Stake))
