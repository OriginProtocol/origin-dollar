import React, { useState, useEffect } from 'react'
import Dropdown from 'components/Dropdown'
import DownCaret from 'components/DownCaret'
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
                  className="dropdown-item justify-content-start align-items-center"
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
          {`${apyDays}${homepage ? ' days' : 'd'}`}
          <span className={`downcaret ${homepage ? 'homepage' : ''}`}>
            <DownCaret color={nav ? 'white' : 'black'} size={26} />
          </span>
        </div>
      </Dropdown>
      <style jsx>{`
        .apy-select {
          background-color: white;
          font-size: 16px;
          font-weight: 500;
          color: black;
          width: 68px;
          height: 25px;
          padding: 0 22px 2px 8px;
          margin-right: 8px;
          border-radius: 20px;
          cursor: pointer;
        }

        .apy-select:hover {
          background-color: #f2f3f5;
        }

        .apy-select.nav {
          background-color: #2f424e;
          color: white;
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
          background-color: white;
          font-size: 16px;
          color: black;
          min-width: 98px;
          top: 100%;
          left: 0;
          padding: 5px;
        }

        .dropdown-item {
          background-color: white;
          color: black;
          padding: 3px 5px 3px 10px;
          line-height: 20px;
          cursor: pointer;
        }

        .dropdown-item:hover {
          background-color: #f2f3f5;
        }

        .downcaret {
          color: red;
          position: absolute;
          left: 42px;
        }

        .downcaret.homepage {
          position: absolute;
          left: 62px;
        }
      `}</style>
    </>
  )
}

export default ApySelect
