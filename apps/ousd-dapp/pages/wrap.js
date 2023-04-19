import React from 'react'
import Layout from 'components/layout'
import Nav from 'components/Nav'

import BalanceHeaderWrapped from 'components/wrap/BalanceHeaderWrapped'
import WrappedSidePanel from 'components/sidePanel/WrappedSidePanel'
import WrapHomepage from 'components/wrap/WrapHomepage'

export default function Wrap({ locale, onLocale }) {
  return (
    <>
      <Layout locale={locale} onLocale={onLocale}>
        <Nav page={'wrap'} locale={locale} onLocale={onLocale} />
        <div className="home d-flex flex-column">
          <BalanceHeaderWrapped />
          <div className="d-flex">
            <div className="content-holder flex-grow d-flex flex-column shadow-div">
              <WrapHomepage />
            </div>
            <WrappedSidePanel />
          </div>
        </div>
      </Layout>
      <style jsx>{`
        .home {
          padding-top: 20px;
        }

        .content-holder {
          border-radius: 10px;
          background-color: #ffffff;
          max-width: 716px;
          min-width: 630px;
        }

        .shadow-div {
          box-shadow: 0 0 14px 0 rgba(24, 49, 64, 0.1);
        }

        .empty-placeholder {
          min-height: 470px;
          height: 100%;
          padding: 70px;
          border-radius: 0 0 10px 10px;
          border-top: solid 1px #cdd7e0;
          background-color: #fafbfc;
        }

        .header-text {
          font-size: 22px;
          line-height: 0.86;
          text-align: center;
          color: black;
          margin-top: 23px;
          margin-bottom: 10px;
        }

        .subtext {
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #8293a4;
          margin-bottom: 50px;
        }

        @media (max-width: 799px) {
          .home {
            padding: 0;
          }

          div {
            width: 100%;
            min-width: 100%;
            max-width: 100%;
          }

          .content-holder {
            max-width: 100%;
            min-width: 100%;
          }
        }
      `}</style>
    </>
  )
}
