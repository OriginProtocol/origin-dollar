import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import Link from 'next/link'
import { assetRootPath } from 'utils/image'

const SidePanelInsuranceMessage = () => {
  const [show, setShow] = useState(true)
  const localStorageKey = 'HideSidePanelInsuranceMessage'

  useEffect(() => {
    setShow(!(localStorage.getItem(localStorageKey) === 'true'))
  }, [])

  return (
    <>
      {show && (
        <div className="side-panel-message d-flex flex-column align-items-center justify-content-center">
          <a
            className={`dismiss-link`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              localStorage.setItem(localStorageKey, 'true')
              setShow(false)
            }}
          >
            ×
          </a>
          <img
            className="insurance-icon"
            src={assetRootPath('/images/ousd-shield-icon.svg')}
          />
          <div>
            {fbt(
              'Get optional smart contract insurance for your OUSD',
              'Get optional smart contract insurance for your OUSD'
            )}
          </div>
          <Link href="https://docs.ousd.com/security-and-risks/insurance">
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-insurance"
            >
              {fbt('Learn more', 'Learn more')}
            </a>
          </Link>
        </div>
      )}
      <style jsx>{`
        .side-panel-message {
          position: relative;
          width: 100%;
          border-radius: 5px;
          background-color: #183140;
          padding: 20px 25px 24px 25px;
          margin-bottom: 10px;
          background-size: contain;
          font-family: Lato;
          font-size: 14px;
          font-weight: bold;
          letter-spacing: normal;
          text-align: center;
          color: white;
          padding-top: 120px;
        }

        .insurance-icon {
          position: absolute;
          height: 185px;
          top: 0;
          z-index: 1;
        }

        .btn-insurance {
          border-radius: 24px;
          padding: 4px 15px 5px 15px;
          font-family: Lato;
          font-size: 14px;
          margin-top: 13px;
          font-weight: bold;
        }

        .dismiss-link {
          display: none;
          position: absolute;
          right: 0px;
          top: -10px;
          opacity: 1;
          font-size: 20px;
          color: white;
          transition: opacity 0.7s ease-out 0.5s;
          padding: 10px;
          cursor: pointer;
        }

        .side-panel-message:hover .dismiss-link {
          display: block;
        }

        .dismiss-link.hidden {
          opacity: 0;
        }
      `}</style>
    </>
  )
}

export default SidePanelInsuranceMessage
