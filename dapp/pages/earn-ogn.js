import React, { useState, useEffect } from 'react'
import CurveStake from 'components/earn/CurveStake'
import Layout from 'components/layout'
import Nav from 'components/Nav'

const Stake = ({ locale, onLocale }) => {
  return (
    <Layout onLocale={onLocale} locale={locale} dapp shorter isStakePage>
      <Nav dapp page={'earn-ogn'} locale={locale} onLocale={onLocale} />
      <CurveStake />
    </Layout>
  )
}

export default Stake
