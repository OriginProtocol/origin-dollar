import React, { useState, useEffect } from 'react'
import StakeUI from 'components/earn/StakeUI'
import CurveStake from 'components/earn/CurveStake'
import Layout from 'components/layout'
import Nav from 'components/Nav'

const Stake = ({ locale, onLocale }) => {
  return (
    <Layout onLocale={onLocale} locale={locale} dapp shorter isStakePage>
      <Nav dapp page={'stake'} locale={locale} onLocale={onLocale} />
      <CurveStake />
      <StakeUI />
    </Layout>
  )
}

export default Stake
