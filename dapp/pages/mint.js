import React from 'react'
import { fbt } from 'fbt-runtime'

const Mint = ({ locale, onLocale }) => {
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

Mint.getInitialProps = async (ctx) => {
  ctx.res.writeHead(302, {
    Location: '/swap',
  })
  ctx.res.end()
  return {}
}

export default Mint
