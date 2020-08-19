import React from 'react'
import Layout from 'components/layout'
import Nav from 'components/Nav'

export default function Earn({ locale, onLocale }) {
  return (
    <Layout>
      <header style={{ minHeight: '100vh' }}>
        <Nav locale={locale} onLocale={onLocale} />
      </header>
      <section className="dark">
        Earn Yields
      </section>
      <section className="light">
        
      </section>
      <section>
        
      </section>
    </Layout>
  )
}
