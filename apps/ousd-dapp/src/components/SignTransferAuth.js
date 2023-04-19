import React, { useState } from 'react'
import { useWeb3React } from '@web3-react/core'
import { useStoreState } from 'pullstate'
import { fbt } from 'fbt-runtime'

import { ethers } from 'ethers'

import ContractStore from 'stores/ContractStore'
import GetOUSD from 'components/GetOUSD'
import { assetRootPath } from 'utils/image'

const SignTransferAuth = ({}) => {
  const { account, active, library } = useWeb3React()
  const [dstAddress, setDstAddress] = useState('')
  const [sig, setSig] = useState(null)
  const [error, setError] = useState(null)
  const { ognStaking } = useStoreState(ContractStore, (s) => {
    if (s.contracts) {
      return s.contracts
    }
    return {}
  })

  return (
    <>
      <div>
        <div className="content-holder flex-grow d-flex flex-column shadow-div">
          {active && (
            <div>
              {' '}
              on {ognStaking.address} Transfer stakes from {account} to:
              <form
                onSubmit={async (e) => {
                  e.preventDefault()

                  if (!dstAddress || !dstAddress.length) {
                    setError('Please enter a destination address')
                    return
                  }

                  const { utils } = ethers
                  const signer = library.getSigner()

                  const s = await signer.signMessage(
                    utils.arrayify(
                      utils.solidityPack(
                        ['string', 'address', 'address', 'address'],
                        ['tran', ognStaking.address, account, dstAddress]
                      )
                    )
                  )
                  const sp = utils.splitSignature(s)

                  setSig(JSON.stringify({ r: sp.r, s: sp.s, v: sp.v }))
                }}
              >
                <input
                  type="text"
                  onChange={(e) => {
                    e.preventDefault()
                    setDstAddress(e.target.value)
                  }}
                  required
                  value={dstAddress}
                  placeholder="Destination Address"
                  className="form-control mb-sm-0"
                />
                <button
                  type="submit"
                  className="d-flex align-items-center justify-content-center"
                >
                  Sign Transfer
                </button>
              </form>
              {sig && (
                <div style={{ overflowWrap: 'anywhere' }}>signature: {sig}</div>
              )}
            </div>
          )}
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
        </div>
      </div>
      <style jsx>{`
        .content-holder {
          border-radius: 10px;
          background-color: #ffffff;
          max-width: 716px;
          min-width: 630px;
        }

        .shadow-div {
          box-shadow: 0 0 14px 0 rgba(24, 49, 64, 0.1);
        }

        .empty-placeholder {
          min-height: 470px;
          height: 100%;
          padding: 70px;
          border-radius: 0 0 10px 10px;
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

        @media (max-width: 799px) {
          div {
            width: 100%;
            min-width: 100%;
            max-width: 100%;
          }

          .content-holder {
            max-width: 100%;
            min-width: 100%;
          }
        }
      `}</style>
    </>
  )
}

export default SignTransferAuth
