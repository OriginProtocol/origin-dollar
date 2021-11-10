import React, { useState, useEffect } from 'react'
import StakeUI from 'components/earn/StakeUI'
import CurveStake from 'components/earn/CurveStake'
import Layout from 'components/layout'
import Nav from 'components/Nav'

const Stake = ({ locale, onLocale }) => {
  return (
    <Layout onLocale={onLocale} locale={locale} dapp shorter isStakePage>
      <Nav dapp page={'stake'} locale={locale} onLocale={onLocale} />
      {process.env.ENABLE_CURVE_STAKING === 'true' && <CurveStake />}
      {process.env.ENABLE_OGN_STAKING === 'true' && <StakeUI />}
    </Layout>
  )
}

export default Stake
