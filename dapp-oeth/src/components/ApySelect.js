import React, { useState } from 'react'
import Dropdown from 'components/Dropdown'
import { assetRootPath } from 'utils/image'

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
                  className="dropdown-item justify-content-start align-items-center"
                  onClick={(e) => {
                    e.preventDefault()
                    setApyDays(days)
                    setOpen(false)
                  }}
                >
                  {`${days}${homepage ? ' days' : 'd'}`}
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
          <div className="downcaret">
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
          margin-right: 200px;
          background-color: #1e1f25;
          color: #fafbfb;
          font-size: 16px;
          min-width: 98px;
          top: 100%;
          left: 0;
          padding: 5px;
          border: solid 1px #141519;
        }

        .dropdown-item {
          color: #fafbfb;
          padding: 3px 5px 3px 10px;
          line-height: 20px;
          cursor: pointer;
        }

        .dropdown-item:hover {
          background-color: rgba(255, 255, 255, 0.1);
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
