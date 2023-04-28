import React from 'react'
import { fbt } from 'fbt-runtime'
import { shortenAddress } from 'utils/web3'

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
          <div className="dot green" />
          {withAddress && (
            <div className="address">{shortenAddress(account)}</div>
          )}
        </>
      )}
      <style jsx>{`
        .address {
          font-size: 14px;
          color: white;
          margin-left: 10px;
          margin-right: 19px;
          margin-bottom: 2px;
        }

        .dot {
          width: 10px;
          height: 10px;
          margin-left: 10px;
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
      `}</style>
    </>
  )
}

export default AccountStatusIndicator
