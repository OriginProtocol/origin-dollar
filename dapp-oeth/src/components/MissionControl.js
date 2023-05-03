import React, { useState } from 'react'
import { useWeb3React } from '@web3-react/core'

import SwapHomepage from 'components/buySell/SwapHomepage'

const MissionControl = ({}) => {
  return (
    <>
      <div className="w-100">
        <SwapHomepage />
      </div>
      {/*<style jsx>{`*/}
      {/*  .content-holder {*/}
      {/*    border-radius: 10px;*/}
      {/*  }*/}

      {/*  .empty-placeholder {*/}
      {/*    min-height: 470px;*/}
      {/*    height: 100%;*/}
      {/*    padding: 70px;*/}
      {/*    border-radius: 0 0 10px 10px;*/}
      {/*    border-top: solid 1px #141519;*/}
      {/*    background-color: #1e1f25;*/}
      {/*  }*/}

      {/*  .header-text {*/}
      {/*    font-size: 22px;*/}
      {/*    line-height: 0.86;*/}
      {/*    text-align: center;*/}
      {/*    color: black;*/}
      {/*    margin-top: 23px;*/}
      {/*    margin-bottom: 10px;*/}
      {/*  }*/}

      {/*  .subtext {*/}
      {/*    font-size: 14px;*/}
      {/*    line-height: 1.36;*/}
      {/*    text-align: center;*/}
      {/*    color: #828699;*/}
      {/*    margin-bottom: 50px;*/}
      {/*  }*/}

      {/*  @media (max-width: 992px) {*/}
      {/*    div {*/}
      {/*      width: 100%;*/}
      {/*      min-width: 100%;*/}
      {/*      max-width: 100%;*/}
      {/*    }*/}

      {/*    .content-holder {*/}
      {/*      max-width: 100%;*/}
      {/*      min-width: 100%;*/}
      {/*    }*/}
      {/*  }*/}
      {/*`}</style>*/}
    </>
  )
}

export default MissionControl
