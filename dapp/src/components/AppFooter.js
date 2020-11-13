import { fbt } from 'fbt-runtime'
import Link from 'next/link'

import mixpanel from 'utils/mixpanel'
import { getDocsLink } from 'utils/getDocsLink'

const jobsURL = process.env.JOBS_URL
const termsURL = process.env.TERMS_URL
const privacyURL = process.env.PRIVACY_URL
const discordURL = process.env.DISCORD_URL

export default function Footer({ locale }) {
  return (
    <>
      <footer>
        <div className="container">
          <div className="row">
            <div className="col-12 col-lg-6 pl-lg-0">
              <nav className="nav d-flex justify-content-center justify-content-lg-start">
                <a
                  href={jobsURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                  onClick={() => {
                    mixpanel.track('Jobs Link click')
                  }}
                >
                  {fbt('Jobs', 'Jobs link')}
                </a>
                <a
                  href={getDocsLink(locale)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                  onClick={() => {
                    mixpanel.track('Docs Link click')
                  }}
                >
                  {fbt('Docs', 'Documentation link')}
                </a>
                <a
                  href={termsURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                  onClick={() => {
                    mixpanel.track('Terms Link click')
                  }}
                >
                  {fbt('Terms', 'Terms link')}
                </a>
                <a
                  href={privacyURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                  onClick={() => {
                    mixpanel.track('Privacy Link click')
                  }}
                >
                  {fbt('Privacy', 'Privacy link')}
                </a>
                <a
                  href={discordURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                  onClick={() => {
                    mixpanel.track('Help Link click')
                  }}
                >
                  {fbt('Help', 'Help link')}
                </a>
              </nav>
            </div>
            <div className="col-12 col-lg-6 text-center text-lg-right pr-lg-0">
              <a
                href="https://originprotocol.com"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link"
              >
                {fbt('Built by Origin Protocol', 'Built by Origin Protocol')}
              </a>
            </div>
          </div>
        </div>
      </footer>
      <style jsx>{`
        footer {
          background-color: #f2f3f5;
          color: #8293a4;
          font-size: 0.75rem;
          padding: 18px 0;
        }

        a:hover {
          color: black;
        }

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}
