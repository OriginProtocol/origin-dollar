import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import Link from 'next/link'
import { assetRootPath } from 'utils/image'

const SidePanelInsuranceMessage = () => {
  const [show, setShow] = useState(true)
  const localStorageKey = 'HideSidePanelWrapMessage'

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
            className="wousd-icon"
            src={assetRootPath('/images/currency/wousd-icon-small.svg')}
          />
          <div>
            {fbt(
              'Wrapped OUSD is a non-rebasing tokenized vault that appreciates in value instead of growing in number',
              'Wrapped OUSD is a non-rebasing tokenized vault that appreciates in value instead of growing in number'
            )}
          </div>
          <Link href="https://docs.ousd.com/core-concepts/wrapped-ousd">
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-wousd"
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
          padding: 95px 27px 24px 27px;
          margin-bottom: 10px;
          background-size: contain;
          font-family: Lato;
          font-size: 14px;
          font-weight: bold;
          letter-spacing: normal;
          text-align: center;
          color: white;
          background-image: radial-gradient(
              circle at 50% 19%,
              rgba(255, 255, 255, 0.2),
              rgba(26, 130, 240, 0) 25%
            ),
            radial-gradient(
              circle at 42% 27.5%,
              rgba(26, 130, 250, 0.7),
              rgba(26, 130, 240, 0) 12%
            );
        }

        .wousd-icon {
          position: absolute;
          height: 65px;
          top: 15px;
          z-index: 1;
        }

        .btn-wousd {
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
