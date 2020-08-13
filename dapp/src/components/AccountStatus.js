import React, { useState, useEffect } from 'react'
import { useWeb3React } from '@web3-react/core'
import { useHistory } from 'react-router-dom'
import { useStoreState } from 'pullstate'

import Dropdown from 'components/Dropdown'
import { isCorrectNetwork, truncateAddress, networkIdToName } from 'utils/web3'
import { usePrevious } from 'utils/helperHooks'
import { fbt } from 'fbt-runtime'

const AccountStatus = ({ className }) => {
  const web3react = useWeb3React()
  const { connector, activate, deactivate, active, error, account, chainId } = web3react
  const [open, setOpen] = useState(false)
  const correctNetwork = isCorrectNetwork(web3react)
  const [loadBalancesInterval, setLoadBalancesInterval] = useState(null)

  const prevActive = usePrevious(active)
  const history = useHistory()
  // redirect to landing page if signed out
  if (prevActive && !active) {
    history.push('/')
  }
  
  return <Dropdown
    className="dropdown"
    content={
      <div className="dropdown-menu dropdown-menu-account show d-flex justify-content-center">
        {!active && <fbt desc="No wallet connected">No wallet connected</fbt>}
        {active && !correctNetwork && <fbt desc="No wallet connected">Incorrect network</fbt>}
        {active && correctNetwork && <fbt desc="No wallet connected">
          Connected to <fbt:param name="network-name">{networkIdToName(chainId)}</fbt:param>
        </fbt>}
      </div>
    }
    open={open}
    onClose={() => setOpen(false)}
  >
    <a 
      className={`account-status d-flex justify-content-center align-items-center ${className}`}
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
      min-width: 300px
  .account-status
    height: 30px
    min-width: 30px
    border-radius: 15px
    border: solid 1px #cdd7e0
    cursor: pointer
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
`)
