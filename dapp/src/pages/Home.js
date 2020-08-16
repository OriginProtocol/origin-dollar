import React, { useEffect, useState } from 'react'
import ethers from 'ethers'
import { get } from 'lodash'

import MissionControl from 'components/MissionControl'
import PrimarySidePanel from 'components/PrimarySidePanel'

const Home = () => {
  

  return (
    <div className="home d-flex">
      <MissionControl />
      <PrimarySidePanel />
    </div>
  )
}

export default Home

require('react-styl')(`
  .home
    padding-top: 80px
`)
