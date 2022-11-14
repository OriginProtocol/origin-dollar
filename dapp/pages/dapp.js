import React, { useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import Head from 'next/head'
import { NextScript } from 'next/document'
import Router from 'next/router'
import { adjustLinkHref } from 'utils/utils'

const Dapp = ({ locale, onLocale }) => {
  useEffect(() => {
    Router.push(adjustLinkHref('/swap'))
  }, [])

  return (
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@700&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
          rel="stylesheet"
        />
        {/* jQuery is required for bootstrap javascript */}
        <NextScript
          src="https://code.jquery.com/jquery-3.6.0.slim.min.js"
          integrity="sha384-Qg00WFl9r0Xr6rUqNLv1ffTSSKEFFCDCKVyHZ+sVt8KuvG99nWw5RNvbhuKgif9z"
        />
        <NextScript
          src="https://cdn.jsdelivr.net/npm/popper.js@1.16.0/dist/umd/popper.min.js"
          integrity="sha384-Q6E9RHvbIyZFJoft+2mJbHaEWldlvI9IOYy5n3zV9zzTtmI3UksdQRVvoxMfooAo"
        />
      </Head>
      {fbt('Redirecting...', 'Redirecting...')}

      <style jsx>{`
        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default Dapp
