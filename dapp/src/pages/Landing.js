import React, { useEffect, useState } from 'react'
import { useWeb3React } from '@web3-react/core'
import ethers from 'ethers'
import { useStoreState } from 'pullstate'

import network from '../../network.json'
import Connectors from '../components/Connectors'
import Redirect from '../components/Redirect'
import LoginWidget from '../components/LoginWidget'
import AccountStore from 'stores/AccountStore'

window.contracts = network.contracts

const governorAddress = '0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4'

const Lading = () => {
  const address = useStoreState(AccountStore, s => s.address)

  return (
    <div className="my-5">
      {address && <Redirect to="/dashboard"/>}
      <div className="d-flex justify-content-center">
        <LoginWidget/>
      </div>
    </div>
  )
}

export default Lading

require('react-styl')(``)
