import React from 'react'
import Layout from 'components/layout'
import Nav from 'components/Nav'

import StakeUI from 'components/earn/StakeUI'
import CurveStake from 'components/earn/CurveStake'

const Stake = ({ locale, onLocale }) => {
  return (
    <Layout onLocale={onLocale} locale={locale} shorter isStakePage>
      <Nav page={'earn'} locale={locale} onLocale={onLocale} />
      {process.env.NEXT_PUBLIC_ENABLE_CURVE_STAKING === 'true' && (
        <CurveStake />
      )}
      {process.env.NEXT_PUBLIC_ENABLE_OGN_STAKING === 'true' && <StakeUI />}
    </Layout>
  )
}

export default Stake
