import React from 'react'
import AccountStore from 'stores/AccountStore'
import { useAccount, useNetwork, useDisconnect } from 'wagmi'
import { useRouter } from 'next/router'
import { useStoreState } from 'pullstate'
import { fbt } from 'fbt-runtime'
import { get } from 'lodash'
import { getEtherscanHost } from 'utils/web3'
import { isCorrectNetwork, truncateAddress } from 'utils/web3'
import { useOverrideAccount } from 'utils/hooks'
import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math'
import { getConnectorIcon } from 'utils/connectors'
import { assetRootPath } from 'utils/image'

const AccountStatusContent = ({ className, onOpen }) => {
  const { chain } = useNetwork()
  const {
    connector: activeConnector,
    address: account,
    isConnected: active,
  } = useAccount()
  const { disconnect: deactivate } = useDisconnect()

  const chainId = chain?.id

  const correctNetwork = isCorrectNetwork(chainId)
  const balances = useStoreState(AccountStore, (s) => s.balances)
  const etherscanLink = `${getEtherscanHost(chainId)}/address/${account}`
  const connectorName = activeConnector?.name
  const connectorIcon = getConnectorIcon(connectorName)
  const { overrideAccount } = useOverrideAccount()
  const router = useRouter()

  return (
    <>
      <div
        className={`${
          className ? className + ' ' : ''
        } account-status-content d-flex flex-column justify-content-center`}
      >
        <div className="drop-container">
          <div className="d-flex align-items-center">
            {active && !correctNetwork && (
              <>
                <div className="dot big yellow" />
                <h2 className="wrong-network">
                  {fbt('Wrong network', 'Wrong network')}
                </h2>
              </>
            )}
            {active && correctNetwork && (
              <div className="d-flex justify-content-between align-items-center account-contain">
                <p>Account</p>
                {!overrideAccount && (
                  <div className="disconnect-box d-flex">
                    <a
                      className=""
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (onOpen) {
                          onOpen(false)
                        }
                        deactivate()
                        localStorage.setItem('eagerConnect', false)
                      }}
                    >
                      {fbt('Disconnect', 'Disconnect')}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
          {active && correctNetwork && (
            <>
              <div className="d-flex align-items-center account-info-contain">
                <img
                  className="connector-image"
                  src={assetRootPath(`/images/${connectorIcon}`)}
                />
                <div className="address">{truncateAddress(account)}</div>

                <a
                  href={etherscanLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="etherscan-icon"
                >
                  <img
                    src={assetRootPath('/images/link-icon-purple.svg')}
                    width="8"
                    height="8"
                  />
                </a>
              </div>
              <div className="d-flex flex-column list-contain">
                {Object.keys(currencies).map((currency, index) => (
                  <div
                    className={`currency d-flex ${
                      index === Object.keys(currencies).length - 1 ? 'last' : ''
                    }`}
                    key={currency}
                  >
                    <img
                      src={assetRootPath(currencies[currency].img)}
                      width="20"
                      height="20"
                    />
                    {formatCurrency(get(balances, currency, 0), 6)} {currency}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {overrideAccount && (
          <div className="disconnect-box d-flex">
            <a
              className="btn-blue w-100 btn-blue-sm"
              onClick={() => {
                router.replace('/history')
              }}
            >
              {fbt('Clear', 'Clear')}
            </a>
          </div>
        )}
      </div>

      <style jsx>{`
        .account-contain {
          font-size: 14px;
          width: 100%;
          border-bottom: 1px solid black;
          padding: 30px 20px;
        }

        .account-info-contain {
          padding: 26px 22px;
          border-bottom: 1px solid black;
        }

        .list-contain {
          padding: 24px;
        }

        .list-contain img {
          margin-right: 8px;
        }

        .drop-container p {
          margin-bottom: 0;
        }

        h2 {
          font-size: 17px;
          color: #183140;
          font-weight: normal;
          margin-bottom: 0px;
        }

        hr {
          height: 1px;
          background-color: #dde5ec;
          width: 100%;
          padding-top: 0px;
          margin-bottom: 12px;
        }

        .connector-image {
          height: 20px;
          margin-right: 10px;
        }

        .wrong-network,
        .connected-to,
        .address {
          font-family: Inter;
          font-size: 16px;
          color: #fafbfb;
          margin-right: 4px;
        }

        .etherscan-icon {
        }

        .etherscan-icon img {
          width: 15px;
        }

        .currency {
          font-family: Inter;
          font-size: 14px;
          color: #fafafb;
          margin-bottom: 16px;
        }

        .currency.last {
          margin-bottom: 0px;
        }

        .disconnect-box {
          background-color: rgba(255, 255, 255, 0.1);
          padding: 4px 20px;
          border-radius: 28px;
        }

        .dropdown-menu {
          top: 115%;
          right: 0;
          border: solid 1px #141519;
          background-color: #1e1f25;
          color: #fafbfb;
          box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.25);
        }

        .account-status-content {
          padding: 0;
          min-width: 250px;
          z-index: 4;
          color: #fafbfb;
        }

        @media (max-width: 799px) {
          .wrong-network,
          .connected-to,
          .address {
            font-size: 12px;
          }

          .dropdown-menu {
            min-width: 75vw;
          }
        }
      `}</style>
    </>
  )
}

export default AccountStatusContent
