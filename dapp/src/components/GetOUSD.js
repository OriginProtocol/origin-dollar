import React from 'react'
import classnames from 'classnames'
import { fbt } from 'fbt-runtime'

import withLoginModal from 'hoc/withLoginModal'
import mixpanel from 'utils/mixpanel'

const docsURL = process.env.DOCS_URL
const launched = process.env.LAUNCHED

const GetOUSD = ({
  className,
  style,
  dark,
  light,
  primary,
  showLogin,
  trackSource,
}) => {
  const classList = classnames(
    'btn d-flex align-items-center justify-content-center',
    className,
    dark && 'btn-dark',
    light && 'btn-light',
    primary && 'btn-primary'
  )

  return (
    <>
      {!launched && (
        <a
          href={docsURL}
          target="_blank"
          rel="noopener noreferrer"
          className={classList}
          style={style}
        >
          {fbt('Learn More', 'Learn more link')}
        </a>
      )}
      {launched && (
        <button
          className={classList}
          style={style}
          onClick={() => {
            mixpanel.track('Get OUSD', {
              source: trackSource,
            })
            if (showLogin) showLogin()
          }}
        >
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

        .btn-primary {
          background-color: #1a82ff;
        }

        .btn-light {
          background-color: white;
        }

        .btn-nav {
          color: white;
          font-size: 0.8125rem;
          font-weight: normal;
          min-height: 0;
          min-width: 0;
        }

        .btn-nav:hover {
          background-color: white;
          color: #183140;
          text-decoration: none;
          opacity: 1;
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
