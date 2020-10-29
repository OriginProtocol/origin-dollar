import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import classnames from 'classnames'

export default function LiquidityMiningWidget({ pool }) {
  const [showChinContents, setShowChinContents] = useState(false)
  const [displayChinContents, setDisplayChinContents] = useState(false)
  const [semiExtend, setSemiExtend] = useState(false)
  const [displayFooterContents, setDisplayFooterContents] = useState(false)
  const [displayFooterContentsBorder, setDisplayFooterContentsBorder] = useState(false)
  const [fullExtend, setFullExtend] = useState(false)

  useEffect(() => {
    setTimeout(() => {
      setSemiExtend(true)
      setTimeout(() => {
      	setDisplayFooterContents(true)
      	setTimeout(() => {
	      	setDisplayFooterContentsBorder(true)
	      }, 200)
      }, 300)
    }, 500)

    setTimeout(() => {
      setFullExtend(true)
      setTimeout(() => {
      	setDisplayChinContents(true)
      	setShowChinContents(true)
      }, 300)
    }, 1000)

  }, [])

  return (
    <>
  		<div className={`blue-chin d-flex flex-column ${semiExtend && !fullExtend ? 'semi-extended' : ''} ${fullExtend ? 'extended' : ''}`}>
  			<div className="main-body d-flex flex-column justify-content-between">
  				<div className="first-part">start</div>
  				{semiExtend && <div className={`main-body-footer flex-grow-1 d-flex align-items-center justify-content-center ${displayFooterContentsBorder ? 'boredered' : ''}`}>
  					{displayFooterContents && fbt('When you unstake, the contract will automatically claim OGN on your behalf', 'Unstake information message')}
  				</div>}
  			</div>
				{displayChinContents && <div className={`chin-contents ${showChinContents ? 'visible' : ''}`}>
					CHIN CONTENTS
				</div>}
  		</div>    
      <style jsx>{`
        .blue-chin {
        	width: 100%;
				  height: 178px;
				  border-radius: 10px;
				  background-color: #1a82ff;
				  transition: height 0.55s ease 0.2s;
        }

        .blue-chin.semi-extended {
				  height: 218px;
        }

        .blue-chin.extended {
				  height: 394px;
        }

        .chin-contents {
          opacity: 0;
          color: white;
          background-color: #1a82ff;
          transition: opacity 0.5s ease 0.3s;
        }

        .chin-contents.visible {
          opacity: 1;
        }

        .main-body {
        	width: 100%;
				  height: 100%;
				  max-height: 218px;
				  border-radius: 10px;
				  border: solid 1px #cdd7e0;
				  background-color: white;
				  transition: height 0.55s ease 0.2s;
        }

        .first-part {
        	height: 178px;
        }

        .main-body-footer {
        	width: 100%;
				  border-radius: 0px 0px 10px 10px;
				  background-color: #fafbfc;
				  font-size: 14px;
				  text-align: center;
				  color: #8293a4;
				  transition: border-top 0.55s ease 0s;
        }

        .main-body-footer.boredered {
        	border-top: solid 1px #cdd7e0;
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </>
  )
}