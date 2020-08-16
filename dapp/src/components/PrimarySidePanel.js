import React, { useState } from 'react'

import SidePanelMessage from 'components/SidePanelMessage'

const PrimarySidePanel = () => {

  return <div className="primary-side-panel d-flex flex-column justify-content-start align-items-center">
    <SidePanelMessage />
  </div>
}

export default PrimarySidePanel

require('react-styl')(`
  .primary-side-panel
    margin-left: 20px
    padding: 10px
    width: 290px
    height: 670px
    border-radius: 10px
    background-color: #f2f3f5
`)