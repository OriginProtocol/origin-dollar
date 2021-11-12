import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import dateformat from 'dateformat'
import EtherscanLink from 'components/earn/EtherscanLink'

import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { formatCurrency } from '../utils/math'
import { shortenAddress } from '../utils/web3'

const TransactionHistory = () => {
  const web3react = useWeb3React()
  const router = useRouter()
  const { account, active } = web3react
  const [history, setHistory] = useState(false)

  const overrideAccount = router.query.override_account

  useEffect(() => {
    if (!active && !overrideAccount) return

    const fetchHistory = async () => {
      const response = await fetch(
        `${process.env.ANALYTICS_ENDPOINT}/api/v1/address/${
          overrideAccount
            ? overrideAccount.toLowerCase()
            : account.toLowerCase()
        }/history`
      )

      if (response.ok) {
        const json = await response.json()
        setHistory(json.history)
      }
    }

    fetchHistory()
  }, [account, active, overrideAccount])

  const txTypeMap = {
    yield: {
      name: fbt('Yield', 'Yield history type'),
      imageName: 'yield_icon.svg'
    },
    transfer_in: {
      name: fbt('Received', 'Received history type'),
      imageName: 'received_icon.svg'
    },
    transfer_out: {
      name: fbt('Sent', 'Sent history type'),
      imageName: 'sent_icon.svg'
    },
    swap_give_ousd: {
      name: fbt('Swap', 'Swap history type'),
      imageName: 'swap_icon.svg'
    },
    swap_gain_ousd: {
      name: fbt('Swap', 'Swap history type'),
      imageName: 'swap_icon.svg'
    },
    unknown_transfer: {
      name: fbt('Unknown transfer', 'Unknown transfer history type'),
      imageName: 'mint_icon.svg'
    },
    unknown: {
      name: fbt('Unknown', 'Unknown history type'),
      imageName: 'mint_icon.svg'
    },
  }

  return (
    <>
      <div className="d-flex holder flex-column justify-content-start">
        {history && (
          <>
            <div className="d-flex grey-font border-bt pb-10">
              <div className="col-2">
                {fbt('Date', 'Transaction history date')}
              </div>
              <div className="col-2">
                {fbt('Type', 'Transaction history type')}
              </div>
              <div className="col-2">
                {fbt('From', 'Transaction history from account')}
              </div>
              <div className="col-2">
                {fbt('To', 'Transaction history to account')}
              </div>
              <div className="col-2">
                {fbt('Amount', 'Transaction history OUSD amount')}
              </div>
              <div className="col-2">
                {fbt('Balance', 'Transaction history OUSD balance')}
              </div>
            </div>
            {history.map((tx) => (
              <div key={tx.tx_hash} className="d-flex border-bt pb-20 pt-20 history-item">
                <div className="col-2">{dateformat(Date.parse(tx.time), 'mm/dd/yyyy') || ''}</div>
                <div className="col-2 d-flex">
                  <img className="mr-3 type-icon" src={`/images/history/${txTypeMap[tx.type].imageName}`}/>
                  {txTypeMap[tx.type].name}
                </div>
                <div className="col-2">
                  {tx.from_address ? shortenAddress(tx.from_address) : '-'}
                </div>
                <div className="col-2">
                  {tx.to_address ? shortenAddress(tx.to_address) : '-'}
                </div>
                <div className="col-2">
                  {tx.amount ? formatCurrency(tx.amount) : '-'}
                </div>
                <div className="col-2 relative">
                  {tx.balance ? formatCurrency(tx.balance) : '-'}
                  <div
                    className="etherscan-link"
                  >
                    <a
                      href={`https://etherscan.io/tx/${tx.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img className="" src="/images/link-icon-grey.svg"/>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <style jsx>{`
        .holder {
          padding: 40px;
          border-radius: 10px;
          box-shadow: 0 0 14px 0 rgba(0, 0, 0, 0.1);
          border: solid 1px #e9eff4;
          background-color: #fafbfc;
          color: black;
        }
        .grey-font {
          color: #8293a4;
          font-size: 12px;
        }
        .border-bt {
          border-bottom: 1px solid #cdd7e0;
        }
        .pb-10 {
          padding-bottom: 10px;
        }
        .pb-20 {
          padding-bottom: 20px;
        }
        .pt-20 {
          padding-top: 20px;
        }
        .history-item {
          font-size: 14px;
        }
        .type-icon {
          width: 11px;
        }
        .etherscan-link {
          position: absolute;
          right: 12px;
          top: 0;
        }
        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default TransactionHistory