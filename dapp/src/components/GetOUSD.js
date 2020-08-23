import React from 'react'
import classnames from 'classnames'

export default function GetOUSD({ className, style, dark, light }) {
  return (
    <button className={
      classnames('btn d-flex align-items-center justify-content-center', className, dark && 'btn-dark', light && 'btn-light')
    } style={style} onClick={() => alert('To do')}>
      Get OUSD
      <style jsx>{`
        button {
          min-width: 201px;
          min-height: 50px;
          font-size: 1.125rem;
          font-weight: bold;
          border-radius: 25px;
        }

        .btn-light {
          background-color: white;
        }

        @media (max-width: 992px) {
          button {
            width: 100%;
          }
        }
      `}</style>
    </button>
  )
}
