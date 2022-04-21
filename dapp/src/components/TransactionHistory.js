import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import dateformat from 'dateformat'
import EtherscanLink from 'components/earn/EtherscanLink'

import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { formatCurrency } from '../utils/math'
import { shortenAddress } from '../utils/web3'
import { exportToCsv, sleep } from '../utils/utils'
import withIsMobile from 'hoc/withIsMobile'
import { assetRootPath } from 'utils/image'

import useTransactionHistoryQuery from '../queries/useTransactionHistoryQuery'

const itemsPerPage = 50

const FilterButton = ({
  filter,
  filterText,
  filterImage,
  filters,
  setFilters,
}) => {
  const selected = filters.includes(filter)
  return (
    <div key={filter}>
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
        <span className="d-none d-md-flex">{filterText}</span>
        <img
          className="d-flex d-md-none"
          src={assetRootPath(`/images/history/${filterImage}`)}
        />
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
          .button {
            min-width: 50px;
            min-height: 35px;
            margin-right: 8px;
            font-size: 14px;
            margin-bottom: 20px;
          }
        }
      `}</style>
    </div>
  )
}

/* If combination of user balance and current APY is so low that users don't get even 1 cent yields
 * we want to show more decimals. If users have high yields (over $1) we show only 2 decimals
 */
const FormatCurrencyByImportance = ({
  value,
  isMobile,
  greaterThanDollarYieldExists,
  greaterThan10CentYieldExists,
}) => {
  const negative = value < 0
  let nrOfDecimals = 4

  if (isMobile || greaterThanDollarYieldExists) {
    nrOfDecimals = 2
  } else if (greaterThan10CentYieldExists) {
    nrOfDecimals = 3
  }

  const nrOfGreyDecimals = nrOfDecimals - 2
  value = formatCurrency(Math.abs(value), nrOfDecimals)
  const first = value.substring(0, value.length - nrOfGreyDecimals)
  const last = value.substring(value.length - nrOfGreyDecimals)

  return (
    <>
      {negative ? '-' : ''}
      {first}
      <span className="grayer">{last}</span>

      <style jsx>{`
        .grayer {
          color: #8293a4;
        }
      `}</style>
    </>
  )
}

const TransactionHistory = ({ isMobile }) => {
  const web3react = useWeb3React()
  const router = useRouter()
  const { account: web3Account, active } = web3react
  const [filters, _setFilters] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageNumbers, setPageNumbers] = useState([])

  const overrideAccount = router.query.override_account
  const account = overrideAccount || web3Account

  const txTypeMap = {
    yield: {
      name: fbt('Yield', 'Yield history type'),
      verboseName: 'Yield',
      imageName: 'yield_icon.svg',
      filter: 'yield',
    },
    transfer_in: {
      name: fbt('Received', 'Received history type'),
      verboseName: 'Received',
      imageName: 'received_icon.svg',
      filter: 'received',
    },
    transfer_out: {
      name: fbt('Sent', 'Sent history type'),
      verboseName: 'Sent',
      imageName: 'sent_icon.svg',
      filter: 'sent',
    },
    swap_give_ousd: {
      name: fbt('Swap', 'Swap history type'),
      verboseName: 'Swap give OUSD',
      imageName: 'swap_icon.svg',
      filter: 'swap',
    },
    swap_gain_ousd: {
      name: fbt('Swap', 'Swap history type'),
      verboseName: 'Swap gain OUSD',
      imageName: 'swap_icon.svg',
      filter: 'swap',
    },
    unknown_transfer: {
      name: fbt('Unknown transfer', 'Unknown transfer history type'),
      verboseName: 'Unknown transfer',
      imageName: 'mint_icon.svg',
      filter: '/',
    },
    unknown_transaction_not_found: {
      name: fbt('Unknown', 'Unknown history type'),
      verboseName: 'Unknown - transaction not found',
      imageName: 'mint_icon.svg',
      filter: '/',
    },
    unknown: {
      name: fbt('Unknown', 'Unknown history type'),
      verboseName: 'Unknown',
      imageName: 'mint_icon.svg',
      filter: '/',
    },
  }

  const setFilters = (filters) => {
    _setFilters(filters)
    setCurrentPage(1)
  }

  const historyQuery = useTransactionHistoryQuery(account)

  const history = useMemo(
    () => (historyQuery.isSuccess ? historyQuery.data : []),
    [historyQuery.isSuccess, historyQuery.data]
  )

  useEffect(() => {
    historyQuery.refetch()
  }, [])

  const shownHistory = useMemo(() => {
    if (filters.length === 0) {
      return history
    } else {
      const allowedFilters = Object.keys(txTypeMap).filter((txType) => {
        return filters.includes(txTypeMap[txType].filter)
      })

      return history.filter((history) => {
        return allowedFilters.includes(history.type)
      })
    }
  }, [history, filters])

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

  const currentPageHistory = useMemo(
    () =>
      [...shownHistory].splice((currentPage - 1) * itemsPerPage, itemsPerPage),
    [shownHistory, currentPage]
  )

  const greaterThanDollarYieldExists =
    currentPageHistory.filter(
      (tx) => tx.type === 'yield' && parseFloat(tx.amount) > 1
    ).length > 0
  const greaterThan10CentYieldExists =
    currentPageHistory.filter(
      (tx) => tx.type === 'yield' && parseFloat(tx.amount) > 0.1
    ).length > 0

  return (
    <>
      <div className="d-flex holder flex-column justify-content-start">
        {historyQuery.isLoading ? (
          <div className="m-4">{fbt('Loading...', 'Loading...')}</div>
        ) : (
          <>
            <div className="filters d-flex justify-content-between">
              <div className="d-flex justify-content-start flex-wrap flex-md-nowrap">
                <FilterButton
                  filterText={fbt('Received', 'Tx history filter: Received')}
                  filterImage="received_icon.svg"
                  filter="received"
                  filters={filters}
                  setFilters={setFilters}
                />
                <FilterButton
                  filterText={fbt('Sent', 'Tx history filter: Sent')}
                  filterImage="sent_icon.svg"
                  filter="sent"
                  filters={filters}
                  setFilters={setFilters}
                />
                <FilterButton
                  filterText={fbt('Swap', 'Tx history filter: Swap')}
                  filterImage="swap_icon.svg"
                  filter="swap"
                  filters={filters}
                  setFilters={setFilters}
                />
                <FilterButton
                  filterText={fbt('Yield', 'Tx history filter: Yield')}
                  filterImage="yield_icon.svg"
                  filter="yield"
                  filters={filters}
                  setFilters={setFilters}
                />
              </div>
              <div className="d-flex">
                <div
                  className="button d-flex align-items-center justify-content-center mb-auto"
                  onClick={() => {
                    const exportDataHeader = [
                      'Date',
                      'Block Number',
                      'Type',
                      'From Address',
                      'To Address',
                      'Amount',
                      'Balance',
                      'Transaction hash',
                    ]

                    exportToCsv('transaction_history.csv', [
                      exportDataHeader,
                      ...shownHistory.map((historyItem) => {
                        return [
                          historyItem.time,
                          historyItem.block_number,
                          historyItem.type,
                          historyItem.from_address || '',
                          historyItem.to_address || '',
                          historyItem.amount,
                          historyItem.balance,
                          historyItem.tx_hash,
                        ]
                      }),
                    ])
                  }}
                >
                  {fbt('Export', 'Tx history action: Export history')}
                </div>
              </div>
            </div>
            <div className="history-holder">
              <div className="d-flex grey-font border-bt pb-10">
                <div className="col-3 col-md-2 pl-0">
                  {fbt('Date', 'Transaction history date')}
                </div>
                <div className="col-3 col-md-2">
                  {fbt('Type', 'Transaction history type')}
                </div>
                <div className="d-none d-md-flex col-2">
                  {fbt('From', 'Transaction history from account')}
                </div>
                <div className="d-none d-md-flex col-2">
                  {fbt('To', 'Transaction history to account')}
                </div>
                <div className="col-3 col-md-2 d-flex justify-content-end pr-md-5">
                  {fbt('Amount', 'Transaction history OUSD amount')}
                </div>
                <div className="col-3 col-md-2 d-flex justify-content-end pr-md-5">
                  {fbt('Balance', 'Transaction history OUSD balance')}
                </div>
              </div>
              {currentPageHistory.map((tx) => {
                return (
                  <div
                    key={`${tx.tx_hash}-${tx.log_index ? tx.log_index : 0}`}
                    className="d-flex border-bt pb-20 pt-20 history-item"
                  >
                    <div
                      className="col-3 col-md-2 pl-0"
                      title={
                        dateformat(
                          Date.parse(tx.time),
                          'mm/dd/yyyy h:MM:ss TT'
                        ) || ''
                      }
                    >
                      {dateformat(
                        Date.parse(tx.time),
                        isMobile ? 'mm/dd/yy' : 'mm/dd/yyyy'
                      ) || ''}
                    </div>
                    <div
                      title={txTypeMap[tx.type].verboseName}
                      className="col-3 col-md-2 d-flex"
                    >
                      <img
                        className="mr-2 mr-md-3 type-icon"
                        src={assetRootPath(
                          `/images/history/${txTypeMap[tx.type].imageName}`
                        )}
                      />
                      {txTypeMap[tx.type].name}
                    </div>
                    <div
                      className={`d-none d-md-flex col-2 ${
                        tx.from_address ? 'clickable' : ''
                      }`}
                      title={tx.from_address}
                      onClick={() => {
                        if (!tx.from_address) return

                        window.open(
                          `https://etherscan.io/address/${tx.from_address}`,
                          '_blank'
                        )
                      }}
                    >
                      {tx.from_address ? shortenAddress(tx.from_address) : '-'}
                    </div>
                    <div
                      className={`d-none d-md-flex col-2 ${
                        tx.to_address ? 'clickable' : ''
                      }`}
                      title={tx.to_address}
                      onClick={() => {
                        if (!tx.from_address) return

                        window.open(
                          `https://etherscan.io/address/${tx.to_address}`,
                          '_blank'
                        )
                      }}
                    >
                      {tx.to_address ? shortenAddress(tx.to_address) : '-'}
                    </div>
                    <div className="col-3 col-md-2 d-flex justify-content-end pr-md-5">
                      {tx.amount ? (
                        <FormatCurrencyByImportance
                          value={tx.amount}
                          isMobile={isMobile}
                          greaterThanDollarYieldExists={
                            greaterThanDollarYieldExists
                          }
                          greaterThan10CentYieldExists={
                            greaterThan10CentYieldExists
                          }
                        />
                      ) : (
                        '-'
                      )}
                    </div>
                    <div className="col-3 col-md-2 d-flex justify-content-end pr-md-5 relative">
                      {tx.balance ? (
                        <FormatCurrencyByImportance
                          value={tx.balance}
                          isMobile={isMobile}
                          greaterThanDollarYieldExists={
                            greaterThanDollarYieldExists
                          }
                          greaterThan10CentYieldExists={
                            greaterThan10CentYieldExists
                          }
                        />
                      ) : (
                        '-'
                      )}
                      <div className="etherscan-link">
                        <a
                          href={`https://etherscan.io/tx/${tx.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            className=""
                            src={assetRootPath('/images/link-icon-grey.svg')}
                          />
                        </a>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="pagination d-flex justify-content-center justify-content-md-start">
              {pageNumbers.map((pageNumber, index) => {
                const isCurrent = pageNumber === currentPage
                const skippedAPage =
                  index > 0 && pageNumber - pageNumbers[index - 1] !== 1

                return (
                  <div className="d-flex" key={pageNumber}>
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
                  </div>
                )
              })}
            </div>
          </>
        )}
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

        .clickable:hover {
          text-decoration: underline;
          cursor: pointer;
        }

        .button {
          color: black;
          min-width: 93px;
          min-height: 40px;
          border-radius: 5px;
          border: solid 1px black;
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
          .filters {
            padding: 20px;
            padding-bottom: 0;
          }

          .history-holder {
            padding-left: 20px;
            padding-right: 20px;
            padding-top: 20px;
          }

          .etherscan-link {
            position: absolute;
            right: -4px;
            top: 0;
          }

          .page-skip {
            margin-right: 8px;
            min-width: 25px;
          }

          .page-number {
            min-width: 25px;
            margin-right: 8px;
            padding-left: 10px;
            padding-right: 10px;
          }

          .pagination {
            padding: 20px;
          }

          .button {
            min-width: 80px;
            min-height: 35px;
            margin-right: 8px;
            font-size: 14px;
            margin-bottom: 20px;
          }
        }
      `}</style>
    </>
  )
}

export default withIsMobile(TransactionHistory)
