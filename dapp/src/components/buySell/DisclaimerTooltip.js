import React, { useState, useEffect } from 'react'
import Dropdown from 'components/Dropdown'

const DisclaimerTooltip = ({
  children,
  id,
  isOpen,
  handleClick,
  handleClose,
  text,
  smallIcon,
  className,
}) => {
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
        open={isOpen}
        onClose={handleClose}
      >
        {children || (
          <a
            className={`d-flex${smallIcon ? '' : ' ml-2'}`}
            onClick={handleClick}
          >
            <img
              className={`question-icon ${smallIcon && 'small-icon'}`}
              src="/images/question-icon.svg"
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
          }
      `}</style>
    </>
  )
}

export default DisclaimerTooltip
