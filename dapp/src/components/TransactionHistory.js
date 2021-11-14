import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import dateformat from 'dateformat'
import EtherscanLink from 'components/earn/EtherscanLink'

import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { formatCurrency } from '../utils/math'
import { shortenAddress } from '../utils/web3'

const itemsPerPage = 10

const FilterButton = ({ filter, filterText, filters, setFilters }) => {
  const selected = filters.includes(filter)
  return (
    <>
      <div
        className={`button d-flex align-items-center justify-content-center ${
          selected ? 'selected' : ''
        }`}
        onClick={() => {
          if (selected) {
            setFilters(filters.filter((ft) => ft != filter))
          } else {
            setFilters([...filters, filter])
          }
        }}
      >
        {filterText}
      </div>
      <style jsx>{`
        .button {
          color: #8293a4;
          min-width: 93px;
          min-height: 40px;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          margin-right: 10px;
          font-family: Lato;
          font-size: 14px;
          cursor: pointer;
        }

        .button.selected,
        .button.selected:hover {
          background-color: black;
          color: white;
        }

        .button:hover {
          background-color: #edf2f5;
        }

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

const TransactionHistory = () => {
  const web3react = useWeb3React()
  const router = useRouter()
  const { account, active } = web3react
  const [history, setHistory] = useState(false)
  const [shownHistory, setShownHistory] = useState(false)
  const [currentPageHistory, setCurrentPageHistory] = useState(false)
  const [filters, _setFilters] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageNumbers, setPageNumbers] = useState([])

  const overrideAccount = router.query.override_account

  const txTypeMap = {
    yield: {
      name: fbt('Yield', 'Yield history type'),
      imageName: 'yield_icon.svg',
      filter: 'yield',
    },
    transfer_in: {
      name: fbt('Received', 'Received history type'),
      imageName: 'received_icon.svg',
      filter: 'received',
    },
    transfer_out: {
      name: fbt('Sent', 'Sent history type'),
      imageName: 'sent_icon.svg',
      filter: 'sent',
    },
    swap_give_ousd: {
      name: fbt('Swap', 'Swap history type'),
      imageName: 'swap_icon.svg',
      filter: 'swap',
    },
    swap_gain_ousd: {
      name: fbt('Swap', 'Swap history type'),
      imageName: 'swap_icon.svg',
      filter: '/',
    },
    unknown_transfer: {
      name: fbt('Unknown transfer', 'Unknown transfer history type'),
      imageName: 'mint_icon.svg',
      filter: '/',
    },
    unknown: {
      name: fbt('Unknown', 'Unknown history type'),
      imageName: 'mint_icon.svg',
      filter: '/',
    },
  }

  const setFilters = (filters) => {
    _setFilters(filters)
    setCurrentPage(1)
    if (filters.length === 0) {
      setShownHistory(history)
    } else {
      const allowedFilters = Object.keys(txTypeMap).filter((txType) => {
        return filters.includes(txTypeMap[txType].filter)
      })

      setShownHistory(
        history.filter((history) => {
          return allowedFilters.includes(history.type)
        })
      )
    }
  }

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
        const history = json.history
        _setFilters([])
        setHistory(history)
        setShownHistory(history)
        setCurrentPage(1)
      }
    }

    fetchHistory()
  }, [account, active, overrideAccount])

  useEffect(() => {
    const length = shownHistory.length
    const pages = Math.ceil(length / itemsPerPage)

    let pageNumbers = [
      1,
      2,
      pages,
      pages - 1,
      currentPage,
      currentPage - 1,
      currentPage + 1,
    ]
    pageNumbers = pageNumbers.filter((number) => number > 0 && number <= pages)
    // distinct
    pageNumbers = [...new Set(pageNumbers)]
    pageNumbers = pageNumbers.sort((a, b) => a - b)
    setPageNumbers(pageNumbers)
  }, [shownHistory, currentPage])

  useEffect(() => {
    if (!shownHistory) return

    setCurrentPageHistory(
      [...shownHistory].splice((currentPage - 1) * itemsPerPage, itemsPerPage)
    )
  }, [shownHistory, currentPage])

  return (
    <>
      <div className="d-flex holder flex-column justify-content-start">
        {currentPageHistory && (
          <>
            <div className="filters d-flex justify-content-start">
              <FilterButton
                filterText={fbt('Received', 'Tx history filter: Received')}
                filter="received"
                filters={filters}
                setFilters={setFilters}
              />
              <FilterButton
                filterText={fbt('Sent', 'Tx history filter: Sent')}
                filter="sent"
                filters={filters}
                setFilters={setFilters}
              />
              <FilterButton
                filterText={fbt('Swap', 'Tx history filter: Swap')}
                filter="swap"
                filters={filters}
                setFilters={setFilters}
              />
              <FilterButton
                filterText={fbt('Yield', 'Tx history filter: Yield')}
                filter="yield"
                filters={filters}
                setFilters={setFilters}
              />
            </div>
            <div className="history-holder">
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
              {currentPageHistory.map((tx) => (
                <div
                  key={tx.tx_hash}
                  className="d-flex border-bt pb-20 pt-20 history-item"
                >
                  <div className="col-2">
                    {dateformat(Date.parse(tx.time), 'mm/dd/yyyy') || ''}
                  </div>
                  <div className="col-2 d-flex">
                    <img
                      className="mr-3 type-icon"
                      src={`/images/history/${txTypeMap[tx.type].imageName}`}
                    />
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
                    <div className="etherscan-link">
                      <a
                        href={`https://etherscan.io/tx/${tx.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img className="" src="/images/link-icon-grey.svg" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="pagination d-flex justify-content-start">
              {pageNumbers.map((pageNumber, index) => {
                const isCurrent = pageNumber === currentPage
                const skippedAPage =
                  index > 0 && pageNumber - pageNumbers[index - 1] !== 1

                return (
                  <>
                    {skippedAPage && (
                      <div className="page-skip d-flex align-items-center justify-content-center">
                        ...
                      </div>
                    )}
                    <div
                      className={`page-number ${
                        isCurrent ? 'current' : ''
                      } d-flex align-items-center justify-content-center`}
                      onClick={() => {
                        if (isCurrent) {
                          return
                        }
                        setCurrentPage(pageNumber)
                      }}
                    >
                      {pageNumber}
                    </div>
                  </>
                )
              })}
            </div>
          </>
        )}
        {!history && <div>{fbt('Loading...', 'Loading...')}</div>}
      </div>
      <style jsx>{`
        .holder {
          border-radius: 10px;
          box-shadow: 0 0 14px 0 rgba(0, 0, 0, 0.1);
          border: solid 1px #e9eff4;
          background-color: #fafbfc;
          color: black;
        }

        .history-holder {
          padding-left: 40px;
          padding-right: 40px;
          padding-top: 24px;
          background-color: white;
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

        .filters {
          padding: 40px;
          background-color: #fafbfc;
          border-bottom: solid 1px #e9eff4;
          border-radius: 10px;
        }

        .pagination {
          padding: 40px;
          background-color: #fafbfc;
          border-top: solid 1px #e9eff4;
          border-radius: 10px;
        }

        .page-number {
          cursor: pointer;
          color: #8293a4;
          min-width: 40px;
          min-height: 40px;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          margin-right: 10px;
          font-size: 14px;
          cursor: pointer;
          padding-left: 15px;
          padding-right: 15px;
        }

        .page-skip {
          color: #8293a4;
          margin-right: 10px;
          min-width: 40px;
          min-height: 40px;
        }

        .page-number.current,
        .page-number.current:hover {
          background-color: black;
          color: white;
        }

        .page-number:hover {
          background-color: #edf2f5;
        }

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default TransactionHistory
