import React, { useState } from 'react'
import { useWeb3React } from '@web3-react/core'

import Dropdown from 'components/Dropdown'

const AccountStatus = ({ className }) => {
  const { connector, activate, deactivate, active, error } = useWeb3React()
  const [open, setOpen] = useState(false)

  console.log("XXX", connector, activate, deactivate, active, error)

  const connected = false
  return <Dropdown
    className="dropdown"
    content={
      <div className="dropdown-menu show">
        asd
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
      <div className={`${connected ? 'connected' : '' } dot`}/>
    </a>
  </Dropdown>
}

export default AccountStatus

require('react-styl')(`

  .account-status
    height: 30px
    min-width: 30px
    border-radius: 15px
    border: solid 1px #cdd7e0
    cursor: pointer
    .dot
      width: 10px
      height: 10px
      border-radius: 5px
      background-color: #ed2a28
      &.connected
        background-color: #00d592
`)
