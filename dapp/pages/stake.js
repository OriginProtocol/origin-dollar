import React from 'react'
import { fbt } from 'fbt-runtime'

const Stake = ({ locale, onLocale }) => {
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

Stake.getInitialProps = async (ctx) => {
  ctx.res.writeHead(302, {
    Location: '/earn',
  })
  ctx.res.end()
  return {}
}

export default Stake
