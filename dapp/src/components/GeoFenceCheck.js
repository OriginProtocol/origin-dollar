import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import useLocalStorage from 'hooks/useLocalStorage'

const GeoFenceCheck = () => {
  const { data: hasConfirmedGeoLocation, onSetItem } = useLocalStorage(
    '@originprotocol/ousd-geo-check',
    false
  )

  const [isChecked, setIsChecked] = useState(false)

  const onAckGeoFence = () => {
    onSetItem(true)
  }

  return (
    <>
      <Modal
        show={!hasConfirmedGeoLocation}
        size="lg"
        aria-labelledby="geofence-modal"
        centered
      >
        <div className="d-flex flex-column geofence-modal">
          <header className="header">
            <h1 className="title">Restricted Access</h1>
          </header>
          <div className="body">
            <p className="info">
              The Origin Dollar dapp is not available to restricted
              jurisdictions. Before proceeding, please carefully read the
              following:
            </p>
            <div className="accept-criteria">
              <ul className="list">
                <li className="item">
                  You confirm that you are not a resident of, citizen of,
                  located in, incorporated in, or have a registered office in
                  the United States or any country or region currently currently
                  subject to sanctions by the United States.
                </li>
                <li className="item">
                  You affirm that you are not a subject of economic or trade
                  sanctions administered or enforced by any governmental
                  authority or otherwise designated on any list of prohibited or
                  restricted parties, including the list maintained by the
                  Office of Foreign Assets Control of the U.S. Department of the
                  Treasury.
                </li>
                <li className="item">
                  You agree not to use any VPN or other privacy or anonymization
                  tools or techniques to attempt to circumvent these eligibility
                  restrictions.
                </li>
                <li className="item">
                  You are lawfully permitted to access this site. You understand
                  and accept the risks associated with using Origin Dollar.
                </li>
              </ul>
            </div>
            <div className="ack">
              <label className="ack-label">
                <div className="ack-container">
                  <input
                    className="ack-checkbox"
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      setIsChecked(e.target.checked)
                    }}
                  />
                </div>

                <span className="label-text">
                  I have read and agree to the above terms{' '}
                </span>
              </label>
            </div>
          </div>
          <footer className="footer">
            <a className="footer-action" href="https://ousd.com">
              Exit
            </a>
            <button
              className="footer-action"
              onClick={onAckGeoFence}
              disabled={!isChecked}
            >
              I agree
            </button>
          </footer>
        </div>
      </Modal>
      <style jsx>{`
        .geofence-modal {
          background-color: #ffffff;
          color: #000000;
          border-radius: 8px;
          max-width: 469px;
          width: 100%;
          margin: 0 auto;
        }

        .geofence-modal .header {
          display: flex;
          align-items: center;
          height: 72px;
          border-bottom: 1px solid #cfd7df;
          padding: 0 24px;
        }

        .geofence-modal .footer {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 24px;
          margin-bottom: 24px;
        }

        .geofence-modal .footer .footer-action {
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 56px;
          background-color: #3d80f7;
          border: none;
          color: #ffffff;
          width: 100%;
        }

        .geofence-modal .footer .footer-action[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .geofence-modal .footer .footer-action + .footer-action {
          margin-left: 12px;
        }

        .geofence-modal .title {
          color: #000000;
          font-family: Lato;
          font-size: 16px;
          font-weight: 700;
          line-height: 28px;
          letter-spacing: 0em;
          text-align: left;
          margin: 0;
        }

        .geofence-modal .body {
          padding: 24px 24px 0 24px;
          text-align: left;
        }

        .geofence-modal .info {
          font-family: Lato;
          font-size: 14px;
          font-weight: 500;
          line-height: 23px;
          letter-spacing: 0em;
          text-align: left;
        }

        .geofence-modal .info.sub {
          font-family: Lato;
          font-size: 12px;
          font-weight: 400;
          line-height: 20px;
          letter-spacing: 0em;
          text-align: left;
        }

        .geofence-modal .accept-criteria {
          padding: 0;
          border-radius: 4px;
          background-color: #fafbfc;
          font-family: Lato;
          font-size: 12px;
          font-weight: 400;
          line-height: 20px;
          letter-spacing: 0em;
          text-align: left;
        }

        .geofence-modal .accept-criteria .list {
          padding: 24px 24px 24px 36px;
          margin: 0;
        }

        .geofence-modal .accept-criteria .list .item + .item {
          margin-top: 18px;
        }

        .geofence-modal .ack {
          display: inline-flex;
          align-items: center;
          margin: 24px 0;
        }

        .geofence-modal .ack .ack-label {
          display: inline-flex;
          align-items: center;
          font-family: Lato;
          font-size: 12px;
          font-weight: 400;
          line-height: 20px;
          letter-spacing: 0em;
          text-align: left;
          margin: 0;
        }

        .geofence-modal .ack .label-text {
          margin-left: 16px;
        }

        .geofence-modal .ack .ack-container {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          overflow: hidden;
        }

        .geofence-modal .ack .ack-checkbox {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </>
  )
}

export default GeoFenceCheck
