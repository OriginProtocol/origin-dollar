import { fbt } from 'fbt-runtime'

import analytics from 'utils/analytics'
import { getDocsLink } from 'utils/getDocsLink'
import LocaleDropdown from 'components/LocaleDropdown'

const analyticsURL = process.env.NEXT_PUBLIC_ANALYTICS_URL
const jobsURL = process.env.NEXT_PUBLIC_JOBS_URL
const termsURL = process.env.NEXT_PUBLIC_TERMS_URL
const privacyURL = process.env.NEXT_PUBLIC_PRIVACY_URL
const discordURL = process.env.NEXT_PUBLIC_DISCORD_URL

export default function Footer({ onLocale, locale }) {
  return (
    <>
      <footer>
        <div className="container">
          <div className="row">
            <div className="col-12 col-lg-6 pl-lg-0">
              <nav className="nav d-flex justify-content-center justify-content-lg-start">
                <a
                  href={analyticsURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                >
                  {fbt('Analytics', 'Analytics link')}
                </a>
                <a
                  href={jobsURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                >
                  {fbt('Jobs', 'Jobs link')}
                </a>
                <a
                  href={getDocsLink(locale)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                >
                  {fbt('Docs', 'Documentation link')}
                </a>
                <a
                  href={termsURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                >
                  {fbt('Terms', 'Terms link')}
                </a>
                <a
                  href={privacyURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                >
                  {fbt('Privacy', 'Privacy link')}
                </a>
                <a
                  href={discordURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                >
                  {fbt('Discord', 'Discord link')}
                </a>
              </nav>
            </div>
            <div className="col-12 col-lg-6 text-center text-lg-right pr-lg-0 d-flex justify-content-end">
              <LocaleDropdown
                footer
                locale={locale}
                onLocale={onLocale}
                outerClassName={'ml-2'}
                className="nav-dropdown"
                useNativeSelectbox={false}
              />
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
          .nav-link {
            padding: 10px;
          }
        }
      `}</style>
    </>
  )
}
