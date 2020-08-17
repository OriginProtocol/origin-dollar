import React from 'react'
import Layout from 'components/layout'
import Nav from 'components/dappNav'

import MissionControl from 'components/MissionControl'
import PrimarySidePanel from 'components/PrimarySidePanel'

export default function DApp({ locale, onLocale }) {
  return (
  	<>
	    <Layout dapp>
        <Nav
        	dapp
        	locale={locale}
        	onLocale={onLocale}
        />
	      <div className="home d-flex">
		      <MissionControl />
		      <PrimarySidePanel />
		    </div>
	    </Layout>
	    <style jsx>{`
	      .home {
    			padding-top: 80px;
	      }
	  	`}</style>
    </>
  )
}
