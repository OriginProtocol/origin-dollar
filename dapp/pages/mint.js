import React, { useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import Router from 'next/router'
import { adjustLinkHref } from 'utils/utils'

const Mint = ({ locale, onLocale }) => {
  useEffect(() => {
    Router.push(adjustLinkHref('/swap'))
  }, [])

  return (
    <>
      {fbt('Redirecting...', 'Redirecting...')}

      <style jsx>{`
        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default Mint
