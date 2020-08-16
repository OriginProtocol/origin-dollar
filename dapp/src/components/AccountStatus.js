import React, { useState, useEffect } from 'react'
import { useWeb3React } from '@web3-react/core'
import { useHistory } from 'react-router-dom'
import { useStoreState } from 'pullstate'
import { fbt } from 'fbt-runtime'
import { get } from 'lodash'

import Dropdown from 'components/Dropdown'
import { isCorrectNetwork, truncateAddress, networkIdToName } from 'utils/web3'
import { usePrevious } from 'utils/helperHooks'
import { currencies } from 'constants/Contract'
import AccountStore from 'stores/AccountStore'

const AccountStatus = ({ className }) => {
  const web3react = useWeb3React()
  const { connector, activate, deactivate, active, error, account, chainId } = web3react

  const [open, setOpen] = useState(false)
  const correctNetwork = isCorrectNetwork(web3react)
  const balances = useStoreState(AccountStore, s => s.balances)
  const address = useStoreState(AccountStore, s => s.address)
  
  const history = useHistory()
  const prevActive = usePrevious(active)

  const logout = () => {
    AccountStore.update(s => {
      s.address = null
      s.allowances = null 
      s.balances = null
    })
    history.push('/')
  }

  useEffect(() => {
    // user has switched to a different Metamask account
    if (account !== address) {
      logout()
    }
  }, [account])

  useEffect(() => {
    // redirect to landing page if signed out
    if (!active) {
      logout()
    }
  }, [active])
  
  const dropdownContent = () => {
    return (
      <div className="dropdown-menu dropdown-menu-account show d-flex flex-column justify-content-center">
        <div className="drop-container">
          <div className="d-flex align-items-center mb-3">
            {!active && <><div className="dot big"/><h2><fbt desc="No wallet connected">No wallet connected</fbt></h2></>}
            {active && !correctNetwork && <><div className="dot big yellow"/><h2><fbt desc="Incorrect network">Incorrect network</fbt></h2></>}
            {active && correctNetwork && <><div className="dot big green"/><h2>
              <fbt desc="connected to">
                Connected to <fbt:param name="network-name">{networkIdToName(chainId)}</fbt:param>
              </fbt></h2></>
            }
          </div>
          {active && correctNetwork && <>
            <hr/>
            <div className="d-flex align-items-start">
              {/* TODO: DO NOT HARDCODE THIS */}
              <img className="connector-image" src='/images/metamask-icon.svg' />
              <div className="d-flex flex-column">
                <div className="address">{truncateAddress(account)}</div>
                {currencies.map(currency => <div
                  className="currency"
                  key={currency}
                >
                  {get(balances, currency, 0.0)} {currency}
                </div>)}
              </div>
            </div>
          </>}
        </div>
        {active && correctNetwork && <div className="disconnect-box d-flex">
          <a
            className="btn-clear-blue w-100"
            onClick={(e) => {
            e.preventDefault()
            setOpen(false)
            deactivate()
            localStorage.setItem('eagerConnect', false)
          }}>
            <fbt desc="Disconnect">Disconnect</fbt>
          </a>
        </div>}
      </div>
    )
  }

  return <Dropdown
    className="dropdown"
    content={dropdownContent()}
    open={open}
    onClose={() => setOpen(false)}
  >
    <a 
      className={`account-status d-flex justify-content-center align-items-center ${className} ${open ? 'open' : ''}`}
      onClick={e => {
        e.preventDefault()
        setOpen(!open)
      }}
    >
      {!active && <div className="dot"/>}
      {active && !correctNetwork && <div className="dot yellow"/>}
      {active && correctNetwork && <div className="dot green"/>}
      {active && account && <div className="address">{truncateAddress(account)}</div>}
    </a>
  </Dropdown>
}

export default AccountStatus

require('react-styl')(`
  .dropdown
    .dropdown-menu.dropdown-menu-account.show
      padding: 16px 0px 0px 0px
      .drop-container
        padding: 0px 20px 0px 20px
      min-width: 270px
      .connector-image
        height: 20px
        margin-right: 12px
        margin-top: 3px
      .address
        font-family: Lato
        font-size: 18px
        color: #183140
        margin-bottom: 10px
      .currency
        font-family: Lato
        font-size: 12px
        color: #8293a4
        margin-bottom: 5px
        text-transform: uppercase
      .disconnect-box
        border-radius: 0px 0px 10px 10px
        border: solid 1px #cdd7e0
        background-color: #fafbfc
        margin: 0px -1px -1px -1px
        padding: 20px
    h2
      font-size: 18px
      color: #1e313f
      font-weight: normal
      margin-bottom: 0px
    hr
      height: 1px
      background-color: #dde5ec
      width: 100%
      padding-top: 0px
      margin-bottom: 12px
  .account-status
    height: 30px
    min-width: 30px
    border-radius: 15px
    border: solid 1px #cdd7e0
    cursor: pointer
    &.open
      background-color: #183140
      .address
        color: white
    .address
      font-size: 14px
      color: #8293a4
      margin-left: 10px
      margin-right: 19px
  .dot
    width: 10px
    height: 10px
    border-radius: 5px
    background-color: #ed2a28
    &.green
      background-color: #00d592
      margin-left: 13px
    &.yellow
      background-color: #ffce45
      margin-left: 13px
    &.big
      width: 16px
      height: 16px
      border-radius: 8px
      margin-right: 12px
      &.green
        margin-left: 0px
      &.yellow
        margin-left: 0px
`)
