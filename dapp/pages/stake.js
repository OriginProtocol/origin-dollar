import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import withRpcProvider from 'hoc/withRpcProvider'

import Layout from 'components/layout'
import Nav from 'components/Nav'
import ContractStore from 'stores/ContractStore'
import StakeStore from 'stores/StakeStore'
import SummaryHeaderStat from 'components/earn/SummaryHeaderStat'
import StakeBoxBig from 'components/earn/StakeBoxBig'
import CurrentStakeLockup from 'components/earn/CurrentStakeLockup'
import EtherscanLink from 'components/earn/EtherscanLink'
import ClaimModal from 'components/earn/modal/ClaimModal'
import { formatCurrencyMinMaxDecimals, formatCurrency } from 'utils/math'
import { enrichStakeData } from 'utils/stake'
import dateformat from 'dateformat'
import SpinningLoadingCircle from 'components/SpinningLoadingCircle'


const Stake = ({ locale, onLocale, rpcProvider }) => {
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [waitingForClaimTx, setWaitingForClaimTx] = useState(false)

  // TODO: get from the contract once the data is in the right format
  const stakes = [
    {
      rate: 0.2,
      amount: 120.123,
      end: 1605908224542,
      duration: 15552000000,
    },
    {
      rate: 0.3,
      amount: 80,
      end: 1605908124542,
      duration: 1555200000,
    }
  ].map(stake => enrichStakeData(stake))

  // TODO: also filter out that the stake has not yet been claimed
  const nonClaimedActiveStakes = stakes.filter(stake => new Date(stake.end) < Date.now())
  const ognToClaim = nonClaimedActiveStakes.map(stake => stake.total).reduce((a, b) => a+b)

  const ognStaking = useStoreState(
    ContractStore,
    (s) => s.contracts && s.contracts.ognStaking
  )

  const { totalPrincipal, totalCurrentInterest } = useStoreState(
    StakeStore,
    (s) => s
  )

  return process.env.ENABLE_LIQUIDITY_MINING === 'true' && <>
    {showClaimModal && (
      <ClaimModal
        onClose={(e) => {
          setShowClaimModal(false)
        }}
        onClaimContractCall={ognStaking.exit}
        ognToClaim={ognToClaim}
        onUserConfirmedClaimTx={async (result) => {
          setWaitingForClaimTx(true)
          const receipt = await rpcProvider.waitForTransaction(result.hash)
          setWaitingForClaimTx(false)
        }}
        onError={(e) => {
          console.log("ERROR HAPPENED: ", e)
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
        <div className="d-flex">
          <div className="col-12 col-md-6 pl-0 pr-10">
            <SummaryHeaderStat
              title={fbt('Total Principal', 'Total Principal')}
              value={parseFloat(totalPrincipal) === 0 ? 0 : formatCurrency(totalPrincipal, 6)}
              valueAppend="OGN"
              className="w-100"
            />
          </div>
          <div className="col-12 col-md-6 pr-0 pl-10">
            <SummaryHeaderStat
              title={fbt('Total Interest', 'Total Interest')}
              value={parseFloat(totalCurrentInterest) === 0 ? 0 : formatCurrency(totalCurrentInterest, 6)}
              valueAppend="OGN"
              className="w-100"
            />
          </div>
        </div>
        <div className="d-flex flex-column lockup-options">
          <div className="title">{fbt('Available Lockups', 'Available Lockups')}</div>
          <div className="d-flex">
            <div className="col-12 col-md-4 pl-0 pr-10">
              <StakeBoxBig
                percentage={8.5}
                duration={90}
                subtitle={fbt('Flexible, steady income', 'Flexible, steady income')}
              />
            </div>
            <div className="col-12 col-md-4 pr-10 pl-10">
              <StakeBoxBig
                percentage={14.5}
                duration={180}
                subtitle={fbt('Best balance', 'Best balance')}
              />
            </div>
            <div className="col-12 col-md-4 pr-0 pl-10">
              <StakeBoxBig
                percentage={30}
                duration={360}
                subtitle={fbt('Most popular, high-yield', 'Most popular, high-yield')}
              />
            </div>
          </div>
        </div>
        <div className="d-flex flex-column current-lockups">
          <div className="title dark">{fbt('Current Lockups', 'Current Lockups')}</div>
          {stakes.map(stake => {
            return <CurrentStakeLockup
              key={stake.end}
              stake={stake}
            />
          })}
          <div className="claim-button-holder d-flex align-items-center justify-content-center">
            <button 
              className="btn-dark"
              onClick={e => {
                setShowClaimModal(true)
              }}
            >
              {!waitingForClaimTx && fbt('Claim OGN', 'Claim OGN')}
              {waitingForClaimTx && (
                <SpinningLoadingCircle backgroundColor="183140" />
              )}
            </button>
          </div>
        </div>
        <div className="d-flex flex-column previous-lockups">
          <div className="title dark">{fbt('Previous Lockups', 'Previous Lockups')}</div>
          <table>
              <thead>
                <tr key="table-head">
                  <td>{fbt('APY', 'APY')}</td>
                  <td>{fbt('Duration', 'Duration')}</td>
                  <td>{fbt('Maturity', 'Maturity')}</td>
                  <td>{fbt('Principal', 'Principal')}</td>
                  <td>{fbt('Interest', 'Interest')}</td>
                  <td>{fbt('Total', 'Total')}</td>
                </tr>
              </thead>
              <tbody>{stakes.map(stake => {
                const enhancedStake = enrichStakeData(stake)
                return <tr key={enhancedStake.end}>
                  <td>{formatCurrencyMinMaxDecimals(enhancedStake.rate * 100, {
                    minDecimals: 0,
                    maxDecimals: 1
                  })}%</td>
                  <td>{fbt(fbt.param('number_of_days', enhancedStake.duration_days) + ' days', 'duration in days')}</td>
                  <td>{dateformat(new Date(enhancedStake.end), 'mm/dd/yyyy')}</td>
                  <td>{formatCurrency(enhancedStake.amount, 6)}</td>
                  <td>{formatCurrency(enhancedStake.interest, 6)}</td>
                  <td>{formatCurrency(enhancedStake.total, 6)}</td>
                </tr>
              })}
              </tbody>
            </table>
        </div>
        {ognStaking && <div className="d-flex justify-content-center">
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

      .title.dark {
        color: #183140;
      }

      .previous-lockups {
        margin-bottom: 50px;
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

      @media (max-width: 799px) {
        .home {
          padding: 0;
        }
      }
    `}</style>
  </>
}

export default withRpcProvider(Stake)
