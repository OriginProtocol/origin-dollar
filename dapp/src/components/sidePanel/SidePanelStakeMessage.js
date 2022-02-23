import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import Link from 'next/link'

import AccountStore from 'stores/AccountStore'
import RouterStore from 'stores/RouterStore'
import { assetRootPath } from 'utils/image'
import { adjustLinkHref } from 'utils/utils'

const SidePanelStakeMessage = () => {
  const balances = useStoreState(AccountStore, (s) => s.balances)
  const routerHistory = useStoreState(RouterStore, (s) => s.history)
  const [show, setShow] = useState(false)
  const previousPath =
    routerHistory.length > 1 ? routerHistory[routerHistory.length - 2] : ''
  const linkTo = previousPath.toLowerCase().startsWith('/pool/')
    ? previousPath
    : '/earn'
  const localStorageKey = 'HideSidePanelStakeMessage'

  useEffect(() => {
    setShow(
      localStorage.getItem(localStorageKey) !== 'true' &&
        process.env.ENABLE_LIQUIDITY_MINING === 'true' &&
        parseFloat(balances.ousd) > 0
    )
  }, [])

  return (
    <>
      {show && (
        <div className="side-panel-message d-flex flex-column align-items-center justify-content-center">
          <a
            className={`dismiss-link`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              localStorage.setItem(localStorageKey, 'true')
              setShow(false)
            }}
          >
            ×
          </a>
          <img
            className="ogn-icon"
            src={assetRootPath('/images/ogn-icon-blue.svg')}
          />
          <div>
            {fbt(
              "You're ready to provide liquidity and deposit to earn OGN",
              'Earn information panel message'
            )}
          </div>
          <Link href={adjustLinkHref(linkTo)}>
            <a className="btn-dark">{fbt('Continue', 'Continue')}</a>
          </Link>
        </div>
      )}
      <style jsx>{`
        .side-panel-message {
          position: relative;
          width: 100%;
          border-radius: 5px;
          min-height: 160px;
          background-color: #1a82ff;
          padding: 20px 25px 14px 25px;
          margin-bottom: 10px;
          background-image: url('/images/earn-coin-waves-blue.svg');
          background-repeat: no-repeat;
          background-position: center top;
          background-size: contain;
          font-family: Lato;
          font-size: 14px;
          font-weight: bold;
          letter-spacing: normal;
          text-align: center;
          color: white;
        }

        .ogn-icon {
          width: 50px;
          height: 50px;
          margin-bottom: 5px;
        }

        .btn-dark {
          font-size: 12px;
          font-weight: bold;
          text-align: center;
          color: white;
          height: 25px;
          margin-top: 13px;
          padding: 3px 25px;
        }

        .dismiss-link {
          display: none;
          position: absolute;
          right: 0px;
          top: -10px;
          opacity: 1;
          font-size: 20px;
          color: white;
          transition: opacity 0.7s ease-out 0.5s;
          padding: 10px;
          cursor: pointer;
        }

        .side-panel-message:hover .dismiss-link {
          display: block;
        }

        .dismiss-link.hidden {
          opacity: 0;
        }
      `}</style>
    </>
  )
}

export default SidePanelStakeMessage
