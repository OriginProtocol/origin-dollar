import React, { useState } from 'react'
import { useStoreState } from 'pullstate'


const ToggleSwitch = ({ coin }) => {
  const [active, setActive] = useState(false)

  return <div className={`coin-toggle d-flex align-items-center justify-content-center ${active ? 'active' : ''}`}>
    <div
      className={`background ${coin}`}
      onClick={e => {
        e.preventDefault()
        setActive(!active)
      }}
    >
      <img className={`toggle ${active ? 'active' : ''}`} src={`/images/currency/${coin}-switch-button-${active ? 'on' : 'off'}.svg`}/>
    </div>
  </div>
}

export default ToggleSwitch

require('react-styl')(`
  .coin-toggle
    cursor: pointer
    .background
      width: 50px
      height: 10px
      border-radius: 15px
      background-color: #bbc9da
      transition: background-color 0.2s linear
      position: relative
      .toggle
        position: absolute
        top: -14px
        left: -6px
        transition: left 0.2s linear
        &.active
          left: 17px
    &.active
      .background
        &.dai
          background-color: #ffce45
        &.usdc
          background-color: #2775CA
        &.usdt
          background-color: #53AE94

`)
