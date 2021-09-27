import React, { useState, useEffect } from 'react'
import { BigNumber } from 'ethers'
import Dropdown from 'components/Dropdown'
import { fbt } from 'fbt-runtime'
import analytics from 'utils/analytics'
import ContractStore from 'stores/ContractStore'
import { useStoreState } from 'pullstate'

const PriceToleranceDropdown = ({
  setPriceToleranceValue,
  priceToleranceValue,
  dropdownToleranceOptions,
}) => {
  const [priceToleranceOpen, setPriceToleranceOpen] = useState(false)

  return (
    <div className="dropdown-holder">
      <Dropdown
        className="d-flex align-items-center min-h-42"
        content={
          <div className="d-flex flex-column dropdown-menu show">
            {dropdownToleranceOptions.map((toleranceOption) => {
              return (
                <div
                  key={toleranceOption}
                  className={`price-tolerance-option ${
                    priceToleranceValue === toleranceOption ? 'selected' : ''
                  }`}
                  onClick={(e) => {
                    e.preventDefault()
                    if (toleranceOption !== priceToleranceValue) {
                      analytics.track('On price tolerance change', {
                        category: 'settings',
                        label: toleranceOption,
                      })
                    }
                    setPriceToleranceValue(toleranceOption)
                    setPriceToleranceOpen(false)
                  }}
                >
                  {toleranceOption}%
                </div>
              )
            })}
          </div>
        }
        open={priceToleranceOpen}
        onClose={() => setPriceToleranceOpen(false)}
      >
        <div
          className="price-tolerance-selected d-flex justify-content-between"
          onClick={(e) => {
            setPriceToleranceOpen(!priceToleranceOpen)
          }}
        >
          <div>{priceToleranceValue ? `${priceToleranceValue}%` : '...'}</div>
          <div>
            <img
              className="tolerance-caret"
              src="/images/caret-left-grey.svg"
            />
          </div>
        </div>
      </Dropdown>
      <style jsx>{`
        .price-tolerance-selected {
          cursor: pointer;
          font-weight: normal;
          padding: 6px 18px;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          background-color: #f2f3f5;
          min-width: 120px;
          min-height: 40px;
        }

        .tolerance-caret {
          width: 5px;
          height: 7px;
          transform: rotate(270deg);
          margin-left: 6px;
        }

        .dropdown-menu {
          top: 115%;
          left: 0;
          right: auto;
          padding: 15px;
        }

        .price-tolerance-option {
          cursor: pointer;
        }

        .price-tolerance-option.selected {
          cursor: auto;
          color: #8293a4;
        }
      `}</style>
    </div>
  )
}

const SettingsDropdown = ({
  setPriceToleranceValue,
  priceToleranceValue,
  dropdownToleranceOptions,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const gasPrice = useStoreState(ContractStore, (s) => s.gasPrice)

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
              <PriceToleranceDropdown
                setPriceToleranceValue={setPriceToleranceValue}
                priceToleranceValue={priceToleranceValue}
                dropdownToleranceOptions={dropdownToleranceOptions}
              />
            </div>
            <div className="d-flex justify-content-between align-items-center margin-top">
              <div className="setting-title">
                {fbt('Gas price', 'Gas price setting')}
              </div>
              <div className="d-flex gas-price-holder">
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
          src="/images/settings-icon.svg"
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

        .gas-price-holder {
          min-width: 120px;
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

        .gwei {
          font-size: 14px;
          color: #8293a4;
          background-color: white;
          border-radius: 0 5px 5px 0;
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
