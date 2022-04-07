import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'

import { usePrevious } from 'utils/hooks'
import analytics from 'utils/analytics'

const DownCaret = ({ swapMode, disableRotation, color = '#8293a4' }) => {
  return (
    <div
      className={`image-holder ${
        swapMode === 'redeem' && !disableRotation ? '' : 'rotated'
      }`}
    >
      <div className="image-holder-internal"></div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="13"
        height="13"
        viewBox="0 1 12 13"
      >
        <g fill="none" fillRule="evenodd">
          <g fill={color} fillRule="nonzero">
            <g>
              <path
                d="M315 338.712L321.012 332.7 319.95 331.638 315.738 335.832 315.738 326.688 314.262 326.688 314.262 335.832 310.086 331.638 308.988 332.7z"
                transform="translate(-559.000000, -523.000000) translate(250.000000, 197.000000)"
              />
            </g>
          </g>
        </g>
      </svg>
      <style jsx>{`
        .image-holder {
          z-index: 3;
          transform: rotate(180deg);
          transition: transform 0.4s ease-out;
        }

        .image-holder.rotated {
          transform: rotate(0deg);
        }

        .image-holder-internal {
          margin-bottom: -2px;
        }
      `}</style>
    </div>
  )
}

const PillArrow = ({ swapMode, setSwapMode }) => {
  return (
    <div className="w-100 d-flex justify-content-center h-0 position-relative">
      <div className="pill-arrow d-flex align-items-center justify-content-center position-absolute">
        <div className="border-divider position-absolute" />
        <div
          className="caret-background position-absolute d-flex align-items-center justify-content-center"
          onClick={() => {
            setSwapMode(swapMode === 'mint' ? 'redeem' : 'mint')
          }}
        >
          <DownCaret disableRotation swapMode={swapMode} />
        </div>
      </div>
      <style jsx>{`
        .pill-arrow {
          width: 40px;
          height: 40px;
          border: 1px solid #cdd7e0;
          background-color: #fafbfc;
          border-radius: 50px;
          margin-top: -25px;
          z-index: 1;
        }

        .border-divider {
          height: 10px;
          background-color: #fafbfc;
          width: 40px;
          z-index: 1;
        }

        .caret-background {
          width: 24px;
          height: 24px;
          border: solid 1px #cdd7e0;
          background-color: #f2f3f5;
          z-index: 2;
          border-radius: 30px;
          cursor: pointer;
        }

        .caret-background:hover {
          background-color: #e2e3e5;
        }
      `}</style>
    </div>
  )
}

export default PillArrow
