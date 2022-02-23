import React from 'react'
import Pool from 'components/earn/Pool'
import { assetRootPath } from 'utils/image'

export default function SummaryHeaderStat({
  title,
  value,
  valueAppend,
  className,
}) {
  return (
    <div
      className={`holder d-flex justify-content-between ${
        className ? className : ''
      }`}
    >
      <div className="title d-flex align-items-center justify-content-center">
        <div>{title}</div>
        {/* <img className="ml-2" src={assetRootPath("/images/question-icon.svg")} /> */}
      </div>
      <div className="value">
        <span>{value}</span>
        <span className="smaller">{valueAppend}</span>
      </div>
      <style jsx>{`
        .holder {
          min-height: 50px;
          padding: 10px 30px;
          border-radius: 5px;
          border: solid 1px #8293a4;
          color: white;
        }

        .title {
          font-size: 15px;
          font-weight: bold;
        }

        .value {
          font-size: 20px;
        }

        .value .smaller {
          font-size: 14px;
          margin-left: 4px;
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </div>
  )
}
