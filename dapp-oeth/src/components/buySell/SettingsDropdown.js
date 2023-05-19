import React, { useState, useEffect } from 'react'
import { BigNumber } from 'ethers'
import Dropdown from 'components/Dropdown'
import { fbt } from 'fbt-runtime'
import analytics from 'utils/analytics'
import ContractStore from 'stores/ContractStore'
import { useStoreState } from 'pullstate'
import { assetRootPath } from 'utils/image'
import { truncateDecimals } from 'utils/math'
import { event } from '../../../lib/gtm'

const SettingsDropdown = ({ setPriceToleranceValue, priceToleranceValue }) => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showWarning, setShowWarning] = useState()
  const gasPrice = useStoreState(ContractStore, (s) => s.gasPrice)

  useEffect(() => {
    setShowWarning(priceToleranceValue > 1)
  }, [priceToleranceValue])

  return (
    <>
      <Dropdown
        className="d-flex align-items-center min-h-42"
        content={
          <div className="d-flex flex-column dropdown-menu show">
            <div className="d-flex flex-column">
              <div className="setting-title">
                {fbt('Price tolerance', 'price tolerance setting')}
              </div>
              <div className="d-flex setting-holder">
                <div className="w-50 d-flex align-items-center">
                  <input
                    value={priceToleranceValue}
                    onChange={(e) => {
                      e.preventDefault()
                      let value = 0
                      if (!isNaN(e.target.value)) {
                        value = e.target.value
                        setShowWarning(value > 1)
                        value = value > 50 ? 50 : value
                        value = truncateDecimals(value, 2)
                        setPriceToleranceValue(value)
                      }
                    }}
                  />
                  <span className="ml-1">%</span>
                </div>
                <button
                  className="w-50 d-flex align-items-center justify-content-center auto"
                  onClick={() => {
                    setPriceToleranceValue(0.1)
                    setShowWarning(false)
                  }}
                >
                  AUTO
                </button>
              </div>
            </div>
            <div className={`warning ${showWarning ? '' : 'hide'}`}>
              Your transaction may be frontrun
            </div>
            <div className="d-flex flex-column margin-top">
              <div className="setting-title">
                {fbt('Gas price', 'Gas price setting')}
              </div>
              <div className="d-flex setting-holder">
                <input
                  type="number"
                  value={Math.floor(gasPrice / Math.pow(10, 9))}
                  onChange={(e) => {
                    let value = e.target.value
                    // ensure positive integers
                    if (value < 0) {
                      value = 0
                    }
                    value = Math.floor(value)
                    value *= Math.pow(10, 9)

                    ContractStore.update((s) => {
                      s.gasPrice = BigNumber.from(value)
                      s.isGasPriceUserOverriden = true
                    })
                  }}
                />
                <span className="gwei ml-1">GWEI</span>
              </div>
            </div>
          </div>
        }
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      >
        <img
          className="settings-icon"
          src={assetRootPath('/images/settings-icon.svg')}
          onClick={(e) => {
            const newOpenState = !settingsOpen
            setSettingsOpen(newOpenState)
            if (!settingsOpen) {
              event({ 
                'event': 'open_settings'
              })
            }
          }}
        />
      </Dropdown>
      <style jsx>{`
        .dropdown-holder {
          position: absolute;
          top: 15px;
          right: 15px;
        }

        .dropdown-menu {
          top: 115%;
          right: 0;
          min-width: 290px;
          padding: 18px 18px 18px 20px;

          border: solid 1px #141519;
          background-color: #1e1f25;
          color: #fafbfb;
        }

        .settings-icon {
          width: 22px;
          height: 22px;
          cursor: pointer;
        }

        .setting-title {
          font-size: 14px;
          font-weight: bold;
          color: #828699;
          margin-bottom: 6px;
        }

        .margin-top {
          margin-top: 15px;
        }

        .setting-holder {
          display: flex;
          align-items: center;
          max-height: 40px;
          min-height: 40px;
        }

        input {
          max-width: 80px;
          font-size: 14px;
          font-weight: normal;
          color: #828699;
          text-align: right;
          background-color: transparent;
          border: 1px solid #0074f0;
          border-radius: 80px;
          height: 40px;
          padding: 0 12px;
        }

        .warning {
          font-size: 14px;
          color: #ffdc86;
          margin-top: 10px;
        }

        .warning.hide {
          display: none;
        }

        .gwei {
          font-size: 14px;
          color: #fafbfb;
        }

        button.auto {
          font-size: 14px;
          color: #fafbfb;
          background: linear-gradient(90deg, #8c66fc -28.99%, #0274f1 144.97%);
          border-radius: 80px;
          margin-left: 30px;
          border: none;
          padding: 0 3px;
          height: 42px;
        }

        @media (max-width: 799px) {
          .dropdown-menu {
            top: 115%;
            right: 0;
            left: auto;
            padding: 12px 12px 12px 14px;
            border: solid 1px #141519;
          }
        }
      `}</style>
    </>
  )
}

export default SettingsDropdown
