import React, { useState, useEffect } from 'react'
import { BigNumber } from 'ethers'
import Dropdown from 'components/Dropdown'
import { fbt } from 'fbt-runtime'
import analytics from 'utils/analytics'
import ContractStore from 'stores/ContractStore'
import { useStoreState } from 'pullstate'
import { assetRootPath } from 'utils/image'
import { truncateDecimals } from 'utils/math'

const SettingsDropdown = ({ setPriceToleranceValue, priceToleranceValue }) => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showWarning, setShowWarning] = useState()
  const gasPrice = useStoreState(ContractStore, (s) => s.gasPrice)

  useEffect(() => {
    setShowWarning(priceToleranceValue > 1)
  }, [priceToleranceValue])

  return (
    <div className="dropdown-holder">
      <Dropdown
        className="d-flex align-items-center min-h-42"
        content={
          <div className="d-flex flex-column dropdown-menu show">
            <div className="d-flex justify-content-between align-items-center">
              <div className="setting-title">
                {fbt('Price tolerance', 'price tolerance setting')}
              </div>
              <div className="d-flex setting-holder">
                <div className="w-50 d-flex align-items-center">
                  <input
                    value={priceToleranceValue}
                    className="tolerance h-100"
                    onChange={(e) => {
                      e.preventDefault()
                      let value = 0
                      if (!isNaN(e.target.value)) {
                        value = e.target.value
                        setShowWarning(value > 1)
                        value = value > 50 ? 50 : value
                        value = truncateDecimals(value, 2)
                        if (value !== priceToleranceValue) {
                          analytics.track('On price tolerance change', {
                            category: 'settings',
                            label: value,
                          })
                        }
                        setPriceToleranceValue(value)
                      }
                    }}
                  />
                  <div>%</div>
                </div>
                <button
                  className="w-50 d-flex align-items-center justify-content-center auto"
                  onClick={() => {
                    setPriceToleranceValue(0.5)
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
            <div className="d-flex justify-content-between align-items-center margin-top">
              <div className="setting-title">
                {fbt('Gas price', 'Gas price setting')}
              </div>
              <div className="d-flex setting-holder">
                <div className="w-50">
                  <input
                    type="number"
                    value={Math.floor(gasPrice / Math.pow(10, 9))}
                    className="w-100 h-100"
                    onChange={(e) => {
                      let value = e.target.value
                      // ensure positive integers
                      if (value < 0) {
                        value = 0
                      }
                      value = Math.floor(value)
                      value *= Math.pow(10, 9)
                      analytics.track('On gas setting change', {
                        category: 'settings',
                        label: value,
                      })

                      ContractStore.update((s) => {
                        s.gasPrice = BigNumber.from(value)
                        s.isGasPriceUserOverriden = true
                      })
                    }}
                  />
                </div>
                <div className="w-50 d-flex align-items-center justify-content-center gwei">
                  GWEI
                </div>
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
            if (newOpenState) {
              analytics.track('On open settings', {
                category: 'settings',
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
          left: 0;
          right: auto;
          min-width: 290px;
          padding: 18px 18px 18px 20px;
        }

        .settings-icon {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .setting-title {
          font-size: 14px;
          font-weight: bold;
          color: #8293a4;
        }

        .margin-top {
          margin-top: 15px;
        }

        .tolerance {
          width: 70%;
        }

        .setting-holder {
          max-width: 120px;
          min-width: 120px;
          max-height: 40px;
          min-height: 40px;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          background-color: #f2f3f5;
        }

        input {
          max-width: 60px;
          border: 0px;
          font-size: 14px;
          font-weight: normal;
          color: black;
          text-align: center;
          border-radius: 5px 0 0 5px;
          background-color: #f2f3f5;
        }

        .warning {
          font-size: 14px;
          color: #ff8000;
          margin-top: 10px;
        }

        .warning.hide {
          display: none;
        }

        .gwei {
          font-size: 14px;
          color: #8293a4;
          background-color: white;
          border-radius: 0 5px 5px 0;
          border-left: solid 1px #cdd7e0;
        }

        button.auto {
          font-size: 14px;
          color: white;
          background-color: #1a82ff;
          border-radius: 0 5px 5px 0;
          border: 0;
          border-left: solid 1px #cdd7e0;
        }

        @media (max-width: 799px) {
          .dropdown-holder {
            top: 7px;
            right: 7px;
          }

          .dropdown-menu {
            top: 115%;
            right: 0;
            left: auto;
            padding: 12px 12px 12px 14px;
          }
        }
      `}</style>
    </div>
  )
}

export default SettingsDropdown
