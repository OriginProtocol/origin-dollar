import React from 'react'
import classnames from 'classnames'
import { fbt } from 'fbt-runtime'

import withLoginModal from 'hoc/withLoginModal'

const launched = process.env.LAUNCHED

const GetOUSD = ({ className, style, dark, light, showLogin }) => {
  const classList = classnames(
    'btn d-flex align-items-center justify-content-center',
    className,
    dark && 'btn-dark',
    light && 'btn-light'
  )

  return (
    <>
      {!launched && (
        <a
          href={process.env.DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={classList}
          style={style}
        >
          {fbt('Learn More', 'Learn more link')}
        </a>
      )}
      {launched && (
        <button className={classList} style={style} onClick={showLogin}>
          {fbt('Get OUSD', 'Get OUSD button')}
        </button>
      )}
      <style jsx>{`
        .btn {
          min-width: 201px;
          min-height: 50px;
          font-size: 1.125rem;
          font-weight: bold;
          border-radius: 25px;
          width: fit-content;
        }

        .btn-light {
          background-color: white;
        }

        @media (max-width: 992px) {
          .btn {
            width: 100%;
          }
        }
      `}</style>
    </>
  )
}

export default withLoginModal(GetOUSD)
