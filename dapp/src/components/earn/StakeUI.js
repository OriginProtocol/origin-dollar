import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { useAccount, useNetwork, useSigner } from 'wagmi'
import withRpcProvider from 'hoc/withRpcProvider'
import { ethers } from 'ethers'
import dateformat from 'dateformat'
import withIsMobile from 'hoc/withIsMobile'
import ContractStore from 'stores/ContractStore'
import StakeStore from 'stores/StakeStore'
import AccountStore from 'stores/AccountStore'
import CurrentStakeLockup from 'components/earn/CurrentStakeLockup'
import EtherscanLink from 'components/earn/EtherscanLink'
import ClaimModal from 'components/earn/modal/ClaimModal'
import { formatCurrency } from 'utils/math'
import { sleep } from 'utils/utils'
import { enrichStakeData, durationToDays, formatRate } from 'utils/stake'
import StakeModal from 'components/earn/modal/StakeModal'
import StakeDetailsModal from 'components/earn/modal/StakeDetailsModal'
import SpinningLoadingCircle from 'components/SpinningLoadingCircle'
import { refetchStakingData } from 'utils/account'
import { addStakeTxHashToWaitingBuffer } from 'utils/stake'
import StakeDetailEquation from 'components/earn/StakeDetailEquation'
import { assetRootPath } from 'utils/image'
import GetOUSD from 'components/GetOUSD'

const StakeUI = ({ rpcProvider, isMobile }) => {
  const { isConnected: active } = useAccount()
  const { data: signer } = useSigner()

  const [showClaimModal, setShowClaimModal] = useState(false)
  const [ognStakingHidden, setOgnStakingHidden] = useState(false)
  const [showStakeModal, setShowStakeModal] = useState(false)
  const [showStakeDetailsEndKey, setShowStakeDetailsEndKey] = useState(null)
  const [selectedDuration, setSelectedDuration] = useState(false)
  const [selectedRate, setSelectedRate] = useState(false)
  const [tokensToStake, setTokensToStake] = useState(0)
  const [error, setError] = useState(null)
  const [waitingForClaimTx, setWaitingForClaimTx] = useState(false)
  const [waitingForStakeTx, setWaitingForStakeTx] = useState(false)
  const [waitingForStakeTxDuration, setWaitingForStakeTxDuration] =
    useState(false)
  const { ogn: ognBalance } = useStoreState(AccountStore, (s) => s.balances)
  const [stakes, setStakes] = useState(null)
  const [nonClaimedActiveStakes, setNonClaimedActiveStakes] = useState(null)
  const [pastStakes, setPastStakes] = useState(null)
  const [vestedStakes, setVestedStakes] = useState(null)
  const [ognToClaim, setOgnToClaim] = useState(null)
  const isLocalEnvironment = process.env.NODE_ENV === 'development'
  const curveStakingEnabled =
    process.env.NEXT_PUBLIC_ENABLE_CURVE_STAKING === 'true'

  const STORY_URL = 'https://www.story.xyz/#/stake'

  const {
    durations,
    rates,
    stakes: rawStakes,
  } = useStoreState(StakeStore, (s) => s)

  const formatBn = (amount, decimals) => {
    return ethers.utils.formatUnits(amount, decimals)
  }

  const connSigner = (contract) => {
    return contract.connect(signer)
  }

  const recalculateStakeData = () => {
    if (rawStakes !== null) {
      const stakes = rawStakes
        .map((rawStake) => {
          const stake = {
            rate: formatBn(rawStake.rate, 18),
            amount: formatBn(rawStake.amount, 18),
            end: formatBn(rawStake.end, 0),
            duration: formatBn(rawStake.duration, 0),
            paid: rawStake.paid,
          }

          if (rawStake.hash) {
            stake.hash = rawStake.hash
          }

          if (rawStake.claimHash) {
            stake.claimHash = rawStake.claimHash
          }

          return stake
        })
        .map((stake) => enrichStakeData(stake))

      const nonClaimedActiveStakes = stakes.filter((stake) => !stake.paid)
      const pastStakes = stakes.filter((stake) => stake.paid)
      const vestedStakes = nonClaimedActiveStakes.filter(
        (stake) => stake.hasVested
      )
      const ognToClaim = vestedStakes
        .map((stake) => stake.total)
        .reduce((a, b) => a + b, 0)

      setStakes(stakes)
      setNonClaimedActiveStakes(nonClaimedActiveStakes)
      setPastStakes(pastStakes)
      setVestedStakes(vestedStakes)
      setOgnToClaim(ognToClaim)
    } else {
      setStakes(null)
      setNonClaimedActiveStakes(null)
      setPastStakes(null)
      setVestedStakes(null)
      setOgnToClaim(null)
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

  const { ognStaking, ogn: ognContract } = useStoreState(ContractStore, (s) => {
    if (s.contracts) {
      return s.contracts
    }
    return {}
  })

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
      return fbt(
        'Staking contract has insufficient OGN funds',
        'Insufficient funds error message'
      )
    } else if (message.includes('all stakes in lock-up')) {
      return fbt(
        'All of the stakes are still in lock-up',
        'All stakes in lock up error message'
      )
    } else if (
      message.includes(
        'please enable contract data on the ethereum app settings'
      )
    ) {
      return fbt(
        'Please enable Contract data on the Ethereum app Settings',
        'Enable contract data error message'
      )
    } else {
      console.error(error)
      return fbt('Unexpected error happened', 'Unexpected error happened')
    }
  }

  return (
    <>
      {showStakeDetailsEndKey && (
        <StakeDetailsModal
          stake={
            stakes.filter((stake) => stake.end === showStakeDetailsEndKey)[0]
          }
          onClose={(e) => {
            setShowStakeDetailsEndKey(null)
          }}
        />
      )}
      {showStakeModal && (
        <StakeModal
          tokenAllowanceSuffiscient={
            /* On prod we whitelist ognStaking to move ogn tokens around. On dev users need to do it manually
             * by clicking on the "Approve staking contract to move OGN" button in dashboard
             */
            true
          }
          tokenToStakeDecimalsCall={ognContract.decimals}
          stakeFunctionCall={async (stakeAmount) => {
            //const stakeAmountString = formatBn(stakeAmount, 18)
            const iface = ognStaking.interface
            const fragment = iface.getFunction(
              'stakeWithSender(address,uint256,uint256)'
            )
            const fnSig = iface.getSighash(fragment)
            const params = ethers.utils.solidityPack(
              ['uint256', 'uint256'],
              [stakeAmount, selectedDuration]
            )
            return connSigner(ognContract).approveAndCallWithSender(
              ognStaking.address,
              stakeAmount,
              fnSig,
              params
            )
          }}
          stakeTokenBalance={ognBalance}
          stakeTokenName="OGN"
          contractApprovingTokenUsage={ognContract}
          contractAllowedToMoveTokens={ognStaking}
          stakeButtonText={fbt('Stake now', 'Stake now')}
          selectTokensAmountTitle={fbt(
            fbt.param('Stake rate', formatRate(selectedRate)) +
              '% - ' +
              fbt.param(
                'Duration in days',
                durationToDays(selectedDuration * 1000)
              ) +
              ' days',
            'Selected duration and staking rate'
          )}
          approveTokensTitle={fbt('Approve & stake', 'Approve & stake')}
          availableToDepositSymbol="OGN"
          tokenIconAndName={
            <div className="d-flex align-items-center">
              <img
                className="coin-icon"
                src={assetRootPath('/images/ogn-icon-blue.svg')}
              />
              <div className="coin-name">OGN</div>
            </div>
          }
          tokenIcon={
            <div className="d-flex align-items-center">
              <img
                className="coin-icon"
                src={assetRootPath('/images/ogn-icon-blue.svg')}
              />
            </div>
          }
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
            addStakeTxHashToWaitingBuffer(
              result.hash,
              formatBn(data.stakeAmount, 18),
              selectedDuration
            )
            const receipt = await rpcProvider.waitForTransaction(result.hash)
            setWaitingForStakeTx(false)
            setWaitingForStakeTxDuration(false)
            refetchStakingData()
          }}
          onError={(e) => {
            setError(toFriendlyError(e))
          }}
          className="wider-stake-input"
          onTokensToStakeChange={(tokens) => {
            setTokensToStake(tokens)
          }}
          underInputFieldContent={
            <div className="w-100 stake-detail-holder">
              <StakeDetailEquation
                duration={selectedDuration}
                durationText={`${durationToDays(selectedDuration * 1000)}d`}
                rate={selectedRate}
                principal={tokensToStake}
              />
            </div>
          }
        />
      )}
      {showClaimModal && (
        <ClaimModal
          onClose={(e) => {
            setShowClaimModal(false)
          }}
          onClaimContractCall={connSigner(ognStaking).exit}
          ognToClaim={ognToClaim}
          onUserConfirmedClaimTx={async (result) => {
            setWaitingForClaimTx(true)
            // just to make the loading circle on the button noticable in local dev
            if (isLocalEnvironment) {
              await sleep(3000)
            }

            vestedStakes.forEach((stake) => {
              // add claim hash to all the vested stakes. That will be stored to local storage and added to contract data
              addStakeTxHashToWaitingBuffer(
                result.hash,
                stake.amount,
                formatCurrency(stake.duration / 1000, 1),
                stake.end,
                true
              )
            })

            const receipt = await rpcProvider.waitForTransaction(result.hash)
            setWaitingForClaimTx(false)
            refetchStakingData()
          }}
          onError={(e) => {
            setError(toFriendlyError(e))
          }}
        />
      )}
      <div className="d-flex flex-column">
        {curveStakingEnabled && (
          <button
            className="toggle-ogn-staking"
            onClick={() => {
              setOgnStakingHidden(!ognStakingHidden)
            }}
          >
            {ognStakingHidden
              ? fbt('Show OGN Staking', 'Show OGN Staking Button')
              : fbt('Hide OGN Staking', 'Hide OGN Staking Button')}
          </button>
        )}
        {!ognStakingHidden && (
          <div className="home d-flex flex-column">
            {stakes === null && active && (
              <div className="loading-text">
                {fbt('Loading...', 'Loading...')}
              </div>
            )}
            {error && (
              <div className="error-box d-flex align-items-center justify-content-center">
                {error}
              </div>
            )}

            <div className="story-banner d-flex flex-column flex-md-row">
              <div className="text-box d-flex flex-column justify-content-center">
                <div className="title-text">
                  {fbt(
                    'Earn ETH when you stake OGN on Origin Story',
                    'Story staking title'
                  )}
                </div>
                <div className="text">
                  {fbt(
                    `OGN staking has moved to Origin's NFT platform. Yields are now generated by fees from primary mints, secondary trading, and royalties.`,
                    'Story staking message'
                  )}
                </div>
                <a
                  className={`d-flex justify-content-center align-items-center`}
                  href={STORY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="story-button btn-dark">Visit story.xyz</div>
                </a>
              </div>
              <img
                className="story-logo"
                src={assetRootPath('/images/story-logo-white.svg')}
              />
              <img
                className="splines"
                src={assetRootPath('/images/splines.png')}
              />
            </div>

            {!active && (
              <div className="empty-placeholder d-flex flex-column align-items-center justify-content-start">
                <img src={assetRootPath('/images/wallet-icons.svg')} />
                <div className="header-text">
                  {fbt('No wallet connected', 'Disconnected dapp message')}
                </div>
                <div className="subtext">
                  {fbt(
                    'Please connect an Ethereum wallet',
                    'Disconnected dapp subtext'
                  )}
                </div>
                <GetOUSD primary connect trackSource="Dapp widget body" />
              </div>
            )}

            {nonClaimedActiveStakes && nonClaimedActiveStakes.length > 0 && (
              <div className="d-flex flex-column current-lockups">
                <div className="title dark">
                  {fbt('Current Lock-ups', 'Current Lock-ups')}
                </div>
                {nonClaimedActiveStakes.map((stake) => {
                  return (
                    <CurrentStakeLockup
                      key={stake.end}
                      stake={stake}
                      onDetailsClick={(e) => {
                        setShowStakeDetailsEndKey(stake.end)
                      }}
                    />
                  )
                })}
                <div className="claim-button-holder d-flex align-items-center justify-content-center">
                  <button
                    className="btn-dark"
                    disabled={!vestedStakes || vestedStakes.length === 0}
                    onClick={(e) => {
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
                      <SpinningLoadingCircle backgroundColor="385160" />
                    )}
                  </button>
                </div>
              </div>
            )}
            {pastStakes && pastStakes.length > 0 && (
              <div className="d-flex flex-column previous-lockups">
                <div className="title dark">
                  {fbt('Previous Lock-ups', 'Previous Lock-ups')}
                </div>
                <table>
                  <thead>
                    <tr key="table-head">
                      <td>{fbt('APY', 'APY')}</td>
                      {!isMobile && (
                        <>
                          <td>{fbt('Duration', 'Duration')}</td>
                          <td>{fbt('Maturity', 'Maturity')}</td>
                          <td>{fbt('Principal', 'Principal')}</td>
                        </>
                      )}
                      <td>{fbt('Interest', 'Interest')}</td>
                      <td>{fbt('Total', 'Total')}</td>
                    </tr>
                  </thead>
                  <tbody>
                    {pastStakes.map((stake) => {
                      const ognDecimals = isMobile ? 2 : 6
                      return (
                        <tr
                          onClick={() => {
                            setShowStakeDetailsEndKey(stake.end)
                          }}
                          className="previous-lockup"
                          key={stake.end}
                        >
                          <td>{formatRate(stake.rate)}%</td>
                          {!isMobile && (
                            <>
                              <td>
                                {fbt(
                                  fbt.param(
                                    'number_of_days',
                                    stake.durationDays
                                  ) + ' days',
                                  'duration in days'
                                )}
                              </td>
                              <td>
                                {dateformat(new Date(stake.end), 'mm/dd/yyyy')}
                              </td>
                              <td>
                                {formatCurrency(stake.amount, ognDecimals)}
                              </td>
                            </>
                          )}
                          <td>{formatCurrency(stake.interest, ognDecimals)}</td>
                          <td>
                            <div className="modal-details-button d-flex align-items-center justify-content-between">
                              <div>
                                {formatCurrency(stake.total, ognDecimals)}
                              </div>
                              <div className="modal-link d-flex align-items-center justify-content-center">
                                <img
                                  className="caret-left"
                                  src={assetRootPath(
                                    '/images/caret-left-grey.svg'
                                  )}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {ognStaking && (
              <div className="d-flex justify-content-center mt-50">
                <EtherscanLink
                  href={`https://etherscan.io/address/${ognStaking.address}`}
                  text={fbt('OGN Staking Contract', 'OGN Staking Contract')}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <style jsx>{`
        .home {
          padding-top: 10px;
        }

        .pr-10 {
          padding-right: 10px !important;
        }

        .pl-10 {
          padding-left: 10px !important;
        }

        .title {
          margin-top: 44px;
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

        .previous-lockup {
          cursor: pointer;
        }

        .previous-lockup:hover {
          opacity: 0.7;
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
          padding-left: 0px !important;
          padding-right: 10px !important;
        }

        .stake-options div:last-child {
          padding-left: 10px !important;
          padding-right: 0px !important;
        }

        .stake-options div:not(:first-child):not(:last-child) {
          padding-left: 10px !important;
          padding-right: 10px !important;
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

        .loading-text {
          font-size: 35px;
          color: white;
          margin-top: 30px;
          margin-bottom: 30px;
        }

        .story-banner {
          width: 100%;
          height: 197px;
          margin-top: 50px;
          padding: 0;
          border-radius: 10px;
          color: white;
          box-shadow: 0 2px 14px 0 rgba(0, 0, 0, 0.1);
          background-image: linear-gradient(102deg, #1a82ff, #0268e2 100%);
        }

        .story-banner .text-box {
          margin-left: 40px;
        }

        .story-banner .title-text {
          margin: 22px 57px 1px 0;
          font-size: 22px;
          font-weight: bold;
          line-height: 1.91;
          color: white;
        }

        .story-banner .text {
          width: 519px;
          margin: 1px 46px 17px 0;
          opacity: 0.8;
          font-size: 16px;
          line-height: normal;
        }

        .story-banner .story-button {
          width: 180px;
          height: 40px;
          margin: 4px 385px 30px 0;
          padding: 0;
          border-radius: 25px;
          background-color: #183140;
          line-height: 2.33;
        }

        .story-banner .story-button:hover {
          opacity: 0.9;
        }

        .story-banner .splines {
          width: 233px;
          height: 197px;
          margin: 0 0 0 auto;
          position: relative;
          z-index: 0;
          object-fit: contain;
        }

        .story-banner .story-logo {
          width: 274px;
          height: 50px;
          margin-top: 75px;
          margin-left: 605px;
          position: absolute;
          z-index: 1;
          object-fit: contain;
        }

        .caret-left {
          transform: rotate(180deg);
          width: 7px;
          height: 14px;
        }

        .stake-detail-holder {
          margin-top: 16px;
          margin-bottom: 30px;
        }

        .toggle-ogn-staking {
          font-size: 14px;
          font-weight: bold;
          text-align: center;
          color: #1a82ff;
          background-color: transparent;
          border: 0;
          margin-top: 67px;
        }

        .toggle-ogn-staking:hover {
          color: #0a72ef;
        }

        .empty-placeholder {
          min-height: 470px;
          height: 100%;
          padding: 70px;
          border-radius: 10px;
          border-top: solid 1px #cdd7e0;
          background-color: #fafbfc;
        }

        .header-text {
          font-size: 22px;
          line-height: 0.86;
          text-align: center;
          color: black;
          margin-top: 23px;
          margin-bottom: 10px;
        }

        .subtext {
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #8293a4;
          margin-bottom: 50px;
        }

        @media (min-width: 768px) {
          .pr-md-10 {
            padding-right: 10px !important;
          }

          .pl-md-10 {
            padding-left: 10px !important;
          }
        }

        @media (max-width: 849px) {
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
            padding-left: 0px !important;
            padding-right: 0px !important;
            margin-bottom: 20px;
          }

          .story-banner .text-box {
            margin-top: 5px;
            margin-left: 18px;
            z-index: 3;
          }

          .story-banner .title-text {
            width: 100%;
            margin-top: 10px;
            font-size: 20px;
            line-height: normal;
          }

          .story-banner .text {
            width: 100%;
            margin-top: 10px;
            margin-bottom: 15px;
            font-size: 14px;
            line-height: normal;
          }

          .story-banner .story-button {
            width: 140px;
            height: 40px;
            font-size: 14px;
            margin: 0 auto 0 0;
          }

          .story-banner .splines {
            position: absolute;
            right: 20px;
          }

          .story-banner .story-logo {
            width: 126px;
            height: 23px;
            margin-top: 160px;
            right: 40px;
            position: absolute;
            z-index: 3;
            object-fit: contain;
          }
        }
      `}</style>
    </>
  )
}

export default withIsMobile(withRpcProvider(StakeUI))
