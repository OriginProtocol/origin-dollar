import React from 'react'
import { fbt } from 'fbt-runtime'
import { shortenAddress } from 'utils/web3'
import { assetRootPath } from 'utils/image'
import { useOverrideAccount } from 'utils/hooks'

const AccountStatusIndicator = ({
  active,
  account,
  correctNetwork,
  withAddress,
}) => {
  const { overrideAccount } = useOverrideAccount()

  return (
    <>
      {/* What causes !active && account? */}
      {!active && account && <div className="dot" />}
      {active && overrideAccount && (
        <>
          <div className="dot white" />
          {withAddress && (
            <div className="address">
              {`${fbt('readonly', 'readonly')}: ${shortenAddress(
                overrideAccount,
                true
              )}`}
            </div>
          )}
        </>
      )}
      {active && !correctNetwork && !overrideAccount && (
        <>
          <div className="dot yellow" />
          {withAddress && (
            <div className="address">
              {fbt('Wrong network', 'Wrong network')}
            </div>
          )}
        </>
      )}
      {active && correctNetwork && !overrideAccount && (
        <>
          <img
            src={assetRootPath('/images/wallet-image.svg')}
            width="20px"
            height="20px"
            className="wallet-img"
          />
          {withAddress && (
            <span className="address d-none d-lg-inline">
              {shortenAddress(account)}
            </span>
          )}
        </>
      )}
      <style jsx>{`
        .address {
          font-size: 16px;
          color: #fafbfb;
        }

        .wallet-img {
          margin-right: 10px;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 5px;
          background-color: #ed2a28;
        }

        .dot.white {
          background-color: #fff;
        }

        .dot.green {
          background-color: #00d592;
        }

        .dot.green.yellow {
          background-color: #ffce45;
        }

        @media (max-width: 992px) {
          .address {
            font-size: 12px;
            color: #fafbfb;
          }

          .wallet-img {
            margin-right: 0px;
          }
        }
      `}</style>
    </>
  )
}

export default AccountStatusIndicator
