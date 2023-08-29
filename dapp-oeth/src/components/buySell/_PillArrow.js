import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'

import { usePrevious } from 'utils/hooks'
import { event } from '../../../lib/gtm'
import { assetRootPath } from '../../utils/image'

const DownCaret = ({ swapMode, disableRotation, color = '#828699' }) => {
  return (
    <div
      className={`image-holder ${
        swapMode === 'redeem' && !disableRotation ? '' : 'rotated'
      }`}
    >
      <img src={assetRootPath('/images/splitarrow.png')} alt="swap arrow" />
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
            event({ event: 'change_input_output' })
          }}
        >
          <img
            src={assetRootPath('/images/splitarrow.svg')}
            alt="swap arrow"
            style={{ height: 23, width: 12 }}
          />
        </div>
      </div>
      <style jsx>{`
        .pill-arrow {
          width: 48px;
          height: 48px;
          border: 1px solid #141519;
          background-color: #1e1f25;
          border-radius: 50px;
          transform: translateY(-50%);
          z-index: 1;
        }

        .border-divider {
          height: 10px;
          background-color: #1e1f25;
          width: 24px;
          z-index: 1;
        }

        .caret-background {
          width: 48px;
          height: 48px;
          border: solid 1px #141519;
          background-color: transparent;
          z-index: 2;
          border-radius: 50px;
          cursor: pointer;
        }

        .caret-background:hover {
          background-color: #18191c;
        }

        @media (max-width: 799px) {
          .caret-background {
            width: 32px;
            height: 32px;
          }

          .pill-arrow {
            width: 32px;
            height: 32px;
          }
        }
      `}</style>
    </div>
  )
}

export default PillArrow
