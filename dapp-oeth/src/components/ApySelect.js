import React, { useState } from 'react'
import classnames from 'classnames'
import Dropdown from 'components/Dropdown'
import { assetRootPath } from 'utils/image'
import { event } from '../../lib/gtm'

const ApySelect = ({ apyDayOptions, apyDays, setApyDays, nav, homepage }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Dropdown
        content={
          <div className="dropdown-menu d-flex flex-column">
            {apyDayOptions.map((days) => {
              return (
                <div
                  key={days}
                  className={classnames(
                    'dropdown-item justify-content-start align-items-center',
                    {
                      selected: String(days) === String(apyDays),
                    }
                  )}
                  onClick={(e) => {
                    e.preventDefault()
                    setApyDays(days)
                    setOpen(false)
                    event({
                      event: 'change_apy',
                      change_apy_to: days,
                    })
                  }}
                >
                  {`${days} day trailing APY`}
                </div>
              )
            })}
          </div>
        }
        open={open}
        onClose={() => setOpen(false)}
      >
        <div
          className={`apy-select ${nav ? 'nav' : ''} ${
            homepage ? 'homepage' : ''
          } d-flex flex-row align-items-center`}
          onClick={(e) => {
            e.preventDefault()
            setOpen(!open)
          }}
        >
          {`${apyDays} day trailing`}
          <div
            className={classnames('downcaret', {
              opened: open,
            })}
          >
            <img
              className="apy-select-icon"
              src={assetRootPath('/images/downcaret.png')}
              alt="APY select arrow"
            />
          </div>
        </div>
      </Dropdown>
      <style jsx>{`
        .apy-select {
          background-color: #1e1f25;
          font-size: 16px;
          font-weight: 500;
          color: #828699;
          cursor: pointer;
        }

        .apy-select.nav {
          background-color: #2f424e;
          color: #fafbfb;
          border: solid 1px white;
        }

        .apy-select.nav:hover {
          background-color: #364c5a;
        }

        .apy-select.homepage {
          width: 90px;
          font-size: 14px;
        }

        .dropdown-menu {
          margin-right: 0;
          background-color: #1e1f25;
          color: #fafbfb;
          font-size: 16px;
          min-width: 140px;
          top: 115%;
          left: -20px;
          border: solid 1px #141519;
          padding: 0;
          overflow: hidden;
          box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.25);
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          color: #fafbfb;
          padding: 10px 16px;
          line-height: 20px;
          cursor: pointer;
          border-bottom: solid 1px #141519;
          font-size: 12px;
        }

        .dropdown-item.selected {
          color: #828699;
        }
        .dropdown-item:nth-child(:last-child) {
          border-bottom: none;
        }

        .dropdown-item:hover {
          background-color: #24252b;
        }

        .downcaret {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 22px;
          width: 22px;
          margin: 0 8px;
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          transition: transform 0.2s ease-in;
        }

        .downcaret.opened {
          transform: rotate(180deg);
        }

        .apy-select-icon {
          position: relative;
          top: 1px;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 8px;
          width: 12px;
        }
      `}</style>
    </>
  )
}

export default ApySelect
