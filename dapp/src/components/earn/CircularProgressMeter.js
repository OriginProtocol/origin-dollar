import React from 'react'
import { fbt } from 'fbt-runtime'
import { getTimeLeftText } from 'utils/stake'
import { assetRootPath } from 'utils/image'

export default function CircularProgressMeter({
  rotate,
  stake,
  bigger,
  shortenDisplayedDuration = false,
}) {
  let progress = stake.percentageVested
  const radius = bigger ? 75 : 65
  const stroke = 10
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  // always show at least 1% progress
  progress = Math.max(progress, 0.01)
  const strokeDashoffset = circumference - progress * circumference
  const timeLeftText = getTimeLeftText(stake, shortenDisplayedDuration)

  return (
    <>
      <div
        className={`inner-circle d-flex align-items-center justify-content-center ${
          rotate ? 'rotate' : ''
        } ${bigger ? 'bigger' : ''}`}
      >
        {progress < 1 && (
          <div className="d-flex align-items-center justify-content-center center-text">
            {timeLeftText}
          </div>
        )}
        {progress === 1 && (
          <img
            className="checkmark"
            src={assetRootPath('/images/checkmark-icon-white.svg')}
          />
        )}
        <div className="blue-circle-cover"></div>
        <svg
          height={radius * 2}
          width={radius * 2}
          className="circle-progress-bar"
        >
          <circle
            stroke="white"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
      </div>
      <style jsx>{`
        .inner-circle {
          width: 100px;
          height: 100px;
          border-radius: 50px;
          background-color: #0d73ed;
          font-size: 14px;
          font-weight: bold;
          line-height: normal;
          position: relative;
        }

        .inner-circle.bigger {
          width: 120px;
          height: 120px;
          border-radius: 60px;
        }

        .inner-circle.rotate {
          transform: rotate(-45deg);
        }

        .circle-progress-bar {
          position: absolute;
        }

        .circle-progress-bar circle {
          transition: stroke-dashoffset 0.35s;
          transform: rotate(-90deg);
          transform-origin: 50% 50%;
          z-index: 1;
        }

        .blue-circle-cover {
          position: absolute;
          background-color: #1a82ff;
          width: 80px;
          height: 80px;
          border-radius: 40px;
          z-index: 2;
        }

        .inner-circle.bigger .blue-circle-cover {
          width: 100px;
          height: 100px;
          border-radius: 50px;
        }

        .center-text {
          font-size: 14px;
          font-weight: bold;
          text-align: center;
          color: white;
          position: relative;
          z-index: 3;
          max-width: 62px;
        }

        .checkmark {
          position: relative;
          z-index: 3;
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </>
  )
}
