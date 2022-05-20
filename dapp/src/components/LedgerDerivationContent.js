import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { ledgerConnector } from 'utils/connectors'
import ContractStore from 'stores/ContractStore'
import { useStoreState } from 'pullstate'
import LedgerAccountContent from './LedgerAccountContent'
import { assetRootPath } from 'utils/image'
import { zipObject } from 'lodash'

const LEDGER_OTHER = "44'/60'/0'/0'"
const LEDGER_LEGACY_BASE_PATH = "44'/60'/0'"
const LEDGER_LIVE_BASE_PATH = "44'/60'/0'/0"

const LedgerDerivationContent = ({}) => {
  const [displayError, setDisplayError] = useState(null)
  const [ledgerPath, setLedgerPath] = useState({})
  const [addresses, setAddresses] = useState({})
  const [addressBalances, setAddressBalances] = useState({})
  const [addressStableBalances, setAddressStableBalances] = useState({})
  const [pathTotals, setPathTotals] = useState({})
  const [ready, setReady] = useState(false)
  const [preloaded, setPreloaded] = useState(false)
  const [activePath, setActivePath] = useState()
  const [next, setNext] = useState({})
  const [nextLoading, setNextLoading] = useState({})

  const contractData = useStoreState(ContractStore, (s) => {
    if (s.coinInfoList) {
      return [
        s.coinInfoList.usdt,
        s.coinInfoList.dai,
        s.coinInfoList.usdc,
        s.coinInfoList.ousd,
      ]
    }
    return []
  })

  const errorMessageMap = (error) => {
    if (!error || !error.message) {
      return 'Unknown error'
    }
    if (
      error.message.includes('Ledger device: UNKNOWN_ERROR') ||
      error.message.includes(
        'Failed to sign with Ledger device: U2F DEVICE_INELIGIBLE'
      )
    ) {
      return fbt(
        'Unlock your Ledger wallet and open the Ethereum application',
        'Unlock ledger'
      )
    } else if (error.message.includes('MULTIPLE_OPEN_CONNECTIONS_DISALLOWED')) {
      return fbt(
        'Unexpected error occurred. Please refresh page and try again.',
        'Unexpected login error'
      )
    }
    return error.message
  }

  const options = [
    {
      display: `Ledger Live`,
      path: LEDGER_LIVE_BASE_PATH,
    },
    {
      display: `Legacy`,
      path: LEDGER_LEGACY_BASE_PATH,
    },
    {
      display: `Ethereum`,
      path: LEDGER_OTHER,
    },
  ]

  const loadBalances = async (path) => {
    if (!(ledgerConnector.provider && addresses[path])) {
      return
    }

    const [balances, stableBalances] = await Promise.all([
      Promise.all(
        addresses[path].map((a) =>
          ledgerConnector
            .getBalance(a)
            .then((r) => (Number(r) / 10 ** 18).toFixed(2))
        )
      ),
      Promise.all(
        addresses[path].map((a) => {
          return Promise.all(
            contractData.map((c) =>
              c.contract.balanceOf(a).then((r) => Number(r) / 10 ** c.decimals)
            )
          )
        })
      ),
    ])

    const ethTotal = balances
      .map((balance) => Number(balance))
      .reduce((a, b) => a + b, 0)

    const stableTotals = stableBalances.map((balance) => {
      return balance.reduce((a, b) => a + b, 0).toFixed(2)
    })

    setAddressBalances({
      ...addressBalances,
      [path]: zipObject(addresses[path], balances),
    })
    setAddressStableBalances({
      ...addressStableBalances,
      [path]: zipObject(addresses[path], stableTotals),
    })
    setPathTotals({ ...pathTotals, [path]: ethTotal })

    // preload addresses for each path
    if (!ledgerPath[LEDGER_LIVE_BASE_PATH]) {
      setLedgerPath({ ...ledgerPath, [LEDGER_LIVE_BASE_PATH]: true })
      onSelectDerivationPath(LEDGER_LIVE_BASE_PATH)
    } else if (!ledgerPath[LEDGER_LEGACY_BASE_PATH]) {
      setLedgerPath({ ...ledgerPath, [LEDGER_LEGACY_BASE_PATH]: true })
      onSelectDerivationPath(LEDGER_LEGACY_BASE_PATH)
    } else if (!ledgerPath[LEDGER_OTHER]) {
      setLedgerPath({ ...ledgerPath, [LEDGER_OTHER]: true })
      onSelectDerivationPath(LEDGER_OTHER)
    } else if (!activePath) {
      // autoselect first path with non-zero ETH balance
      if (pathTotals[LEDGER_LIVE_BASE_PATH] > 0) {
        setActivePath(LEDGER_LIVE_BASE_PATH)
      } else if (pathTotals[LEDGER_LEGACY_BASE_PATH] > 0) {
        setActivePath(LEDGER_LEGACY_BASE_PATH)
      } else if (ethTotal > 0) {
        setActivePath(LEDGER_OTHER)
      } else setActivePath(LEDGER_LIVE_BASE_PATH)
    }
    setPreloaded(
      ledgerPath[LEDGER_LIVE_BASE_PATH] &&
        ledgerPath[LEDGER_LEGACY_BASE_PATH] &&
        ledgerPath[LEDGER_OTHER]
    )

    // indicators for scrolling to next address page within path
    setNext({
      [activePath]: nextLoading[activePath] ? !next[activePath] : false,
    })
    setNextLoading({ [activePath]: false })
  }

  useEffect(() => {
    if (ready) loadBalances(LEDGER_LIVE_BASE_PATH)
  }, [addresses[LEDGER_LIVE_BASE_PATH]])

  useEffect(() => {
    if (ready) loadBalances(LEDGER_LEGACY_BASE_PATH)
  }, [addresses[LEDGER_LEGACY_BASE_PATH]])

  useEffect(() => {
    if (ready) loadBalances(LEDGER_OTHER)
  }, [addresses[LEDGER_OTHER]])

  const loadAddresses = async (path, next) => {
    if (!ledgerConnector.provider) {
      return
    }

    setLedgerPath({ ...ledgerPath, [path]: true })
    if (next) {
      setAddresses({
        ...addresses,
        [path]: (await ledgerConnector.getAccounts(10)).slice(5),
      })
    } else {
      setAddresses({
        ...addresses,
        [path]: await ledgerConnector.getAccounts(5),
      })
    }
  }

  useEffect(() => {
    onSelectDerivationPath(LEDGER_LIVE_BASE_PATH)
    setReady(true)
  }, [])

  const onSelectDerivationPath = async (path, next) => {
    try {
      await ledgerConnector.activate()
      await ledgerConnector.setPath(path)
      setDisplayError(null)
    } catch (error) {
      setDisplayError(errorMessageMap(error))
      return
    }
    loadAddresses(path, next)
  }

  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation()
        }}
        className={`ledger-derivation-content d-flex flex-column`}
      >
        <h2>
          {fbt(
            'Select a Ledger derivation path',
            'Select a Ledger derivation path'
          )}
        </h2>
        <div className={`paths d-flex flex-row`}>
          {options.map((option) => {
            return (
              <button
                key={option.path}
                className={
                  'text-center ' + (activePath === option.path && 'active')
                }
                onClick={() => {
                  if (!nextLoading[option.path]) {
                    setActivePath(option.path)
                    if (next[activePath]) {
                      // reset path to first address page in the background after clicking different path
                      setNextLoading({ [activePath]: true })
                      onSelectDerivationPath(activePath)
                    }
                  }
                }}
              >
                {option.display}
                <br />
                <span className="button-path">{`m/${option.path}`}</span>
              </button>
            )
          })}
        </div>
        {displayError && (
          <div className="error d-flex align-items-center justify-content-center">
            {displayError}
          </div>
        )}
        <div className="d-flex flex-column align-items-center justify-content-center">
          {activePath && preloaded ? (
            <>
              {nextLoading[activePath] && (
                <img
                  className="waiting-icon rotating mx-auto"
                  src={assetRootPath('/images/spinner-green-small.png')}
                />
              )}
              {!nextLoading[activePath] && (
                <LedgerAccountContent
                  addresses={addresses[activePath]}
                  addressBalances={addressBalances[activePath]}
                  addressStableBalances={addressStableBalances[activePath]}
                  activePath={activePath}
                />
              )}
              {!next[activePath] && !nextLoading[activePath] && (
                <button
                  className="button-arrow"
                  onClick={() => {
                    setNextLoading({ [activePath]: true })
                    onSelectDerivationPath(activePath, true)
                  }}
                >
                  <img
                    className="arrow-icon"
                    src={assetRootPath('/images/arrow-down.png')}
                  />
                </button>
              )}
              {next[activePath] && !nextLoading[activePath] && (
                <button
                  className="button-arrow"
                  onClick={() => {
                    setNextLoading({ [activePath]: true })
                    onSelectDerivationPath(activePath)
                  }}
                >
                  <img
                    className="arrow-icon"
                    src={assetRootPath('/images/arrow-up.png')}
                  />
                </button>
              )}
            </>
          ) : (
            !displayError && (
              <img
                className="waiting-icon rotating mx-auto"
                src={assetRootPath('/images/spinner-green-small.png')}
              />
            )
          )}
        </div>
      </div>
      <style jsx>{`
        .ledger-derivation-content {
          padding: 26px 22px 20px 22px;
          max-width: 500px;
          min-width: 500px;
          box-shadow: 0 0 14px 0 rgba(24, 49, 64, 0.1);
          background-color: white;
          border-radius: 10px;
          align-items: center;
          justify-content: center;
        }

        .ledger-derivation-content h2 {
          padding-left: 12px;
          padding-right: 12px;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          line-height: normal;
          margin-bottom: 14px;
        }

        .ledger-derivation-content .paths {
          width: 100%;
          justify-content: center;
        }

        .ledger-derivation-content button {
          width: 100%;
          height: 55px;
          border-radius: 50px;
          border: solid 1px #1a82ff;
          background-color: white;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          color: #1a82ff;
          padding: 5px 10px;
          margin: 10px 5px 20px 5px;
          line-height: 22px;
        }

        .ledger-derivation-content .button-path {
          font-size: 14px;
          color: #a0a0a0;
        }

        .active {
          background-color: #c0e0ff !important;
        }

        .error {
          margin-top: 20px;
          padding: 5px 8px;
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #ed2a28;
          border-radius: 5px;
          border: solid 1px #ed2a28;
          min-height: 50px;
          width: 100%;
        }

        .button-arrow {
          width: 70px !important;
          height: 35px !important;
          padding: 0 !important;
          margin: 10px 0 0 0 !important;
        }

        .arrow-icon {
          width: 25px;
          height: 25px;
        }

        .waiting-icon {
          width: 25px;
          height: 25px;
        }

        .rotating {
          -webkit-animation: spin 2s linear infinite;
          -moz-animation: spin 2s linear infinite;
          animation: spin 2s linear infinite;
        }

        @-moz-keyframes spin {
          100% {
            -moz-transform: rotate(360deg);
          }
        }
        @-webkit-keyframes spin {
          100% {
            -webkit-transform: rotate(360deg);
          }
        }
        @keyframes spin {
          100% {
            -webkit-transform: rotate(360deg);
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  )
}

export default LedgerDerivationContent
