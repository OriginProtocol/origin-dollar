import React, { useState, useEffect } from 'react'
import Dropdown from 'components/Dropdown'
import { assetRootPath } from 'utils/image'

const DisclaimerTooltip = ({
  children,
  id,
  isOpen,
  onClose,
  text,
  smallIcon,
  className,
}) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Dropdown
        className={`dropdown d-flex flex-grow-1${
          className ? ` ${className}` : ''
        }`}
        content={
          <div id={id} className="disclaimer-popover">
            {text}
          </div>
        }
        open={open}
        onClose={(e) => {
          if (onClose) {
            onClose(e)
          }
          setOpen(false)
        }}
      >
        {children && (
          <div
            className="d-flex align-items-center justify-content-center"
            onClick={(e) => {
              e.preventDefault()
              setOpen(!open)
            }}
          >
            {children}
          </div>
        )}
        {!children && (
          <a
            className={`d-flex${smallIcon ? '' : ' ml-2'}`}
            onClick={(e) => {
              e.preventDefault()
              setOpen(!open)
            }}
          >
            <img
              className={`question-icon ${smallIcon && 'small-icon'}`}
              src={assetRootPath('/images/question-icon.svg')}
              alt="Help icon"
            />
          </a>
        )}
      </Dropdown>
      <style jsx>{`
        .disclaimer-popover {    
          overflow: unset;
          white-space: normal;
          position: absolute;
          padding: 22px 29px;
          left: 40px;
          width: 280px;
          border-radius: 10px;
          box-shadow: 0 0 34px 0 rgba(24, 49, 64, 0.2);
          border: solid 1px #cdd7e0;
          background-color: #ffffff;
          font-size: 14px;
          line-height: 1.36;
          color: #183140;
          font-weight: normal;
          z-index: 99;
        }

        .small-icon {
          height: 16px;
          width: 16px;
        }

        a:hover {
          cursor: pointer;
        }

        @media (max-width: 799px) {
          .disclaimer-popover {
            position: fixed;
            left: 10%;
            width: 80%;
            bottom: 0px;
          }
      `}</style>
    </>
  )
}

export default DisclaimerTooltip
