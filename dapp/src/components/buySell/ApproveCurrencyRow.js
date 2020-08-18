import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'

import ContractStore from 'stores/ContractStore'

const ApproveCurrencyRow = ({ coin, isLast }) => {
  //approve, waiting-user, waiting-network, done
  const [stage, setStage] = useState('approve')
  const [contract, setContract] = useState(null)
  const { Vault, MockUSDT, MockDAI, MockUSDC } = useStoreState(ContractStore, s => s.contracts || {})

  useEffect(() => {
    if (coin === 'dai') {
      setContract(MockDAI)
    } else if (coin === 'usdt') {
      setContract(MockUSDT)
    } else if (coin === 'usdc') {
      setContract(MockUSDC)
    }

  }, [])

  return <>
    <div className={`currency-row d-flex ${isLast ? 'last' : ''}`}>
      <img className="icon" src={`/images/currency/${coin}-icon-small.svg`}/>
      {stage === 'approve' && <>
        {fbt('Permission to use ' + fbt.param('coin-name', coin.toUpperCase()), 'permission to use coin')}
        <a
          className="blue-btn d-flex align-items-center justify-content-center"
          onClick={ async e => {
            setStage('waiting-user')
            try {
              await contract.approve(
                Vault.address,
                ethers.utils.parseUnits('10000000.0', await contract.decimals())
              )
              // todo: listen for event here and approve once it is done
              //setStage('waiting-network')
              setStage('done')
            } catch (e) {
              setStage('approve')
            }
          }}
        >
          {fbt('Approve', 'Approve')}  
        </a>
      </>}
      {stage === 'waiting-user' && <>
        {fbt('Waiting for you to approve...', 'Waiting for you to approve...')}
        <img className="waiting-icon ml-auto" src="/images/metamask-icon.svg"/>
      </>}
      {stage === 'waiting-network' && <>
        {fbt('Approving ' + fbt.param('coin-name', coin.toUpperCase() + '...'), 'approving coin')}
        <img className="waiting-icon ml-auto" src="/images/spinner-green-small.png"/>
      </>}
      {stage === 'done' && <>
        {fbt(fbt.param('coin-name', coin.toUpperCase() + ' approved'), 'Coin approved')}
        <img className="waiting-icon ml-auto" src="/images/green-check.svg"/>
      </>}
    </div>
    <style jsx>{`
      .currency-row {
        padding-top: 13px;
        padding-bottom: 13px;
        border-bottom: 1px solid #dde5ec;
      }

      .currency-row.last {
        border-bottom: 0px;
      }

      .icon {
        margin-right: 10px;
        width: 30px;
        height: 30px;
      }

      .waiting-icon {
        width: 30px;
        height: 30px;
      }

      .blue-btn {
        margin-left: auto;
        height: 35px;
        border-radius: 25px;
        background-color: #1a82ff;
        padding-left: 19px;
        padding-right: 19px;
        color: white;
        cursor: pointer;
      }

      .blue-btn:hover { 
        background-color: #0a72ef;
        text-decoration: none;
      }
    `}</style>
  </>
}

export default ApproveCurrencyRow
  