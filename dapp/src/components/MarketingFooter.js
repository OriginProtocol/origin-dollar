import { fbt } from 'fbt-runtime'
import analytics from 'utils/analytics'
import { getDocsLink } from 'utils/getDocsLink'
import { assetRootPath } from 'utils/image'

import EmailForm from './EmailForm'

const analyticsURL = process.env.ANALYTICS_URL
const jobsURL = process.env.JOBS_URL
const termsURL = process.env.TERMS_URL
const privacyURL = process.env.PRIVACY_URL
const discordURL = process.env.DISCORD_URL
const telegramURL = process.env.TELEGRAM_URL
const wechatURL = process.env.WECHAT_URL
const githubURL = process.env.GITHUB_URL
const redditURL = process.env.REDDIT_URL
const weiboURL = process.env.WEIBO_URL
const facebookURL = process.env.FACEBOOK_URL
const twitterURL = process.env.TWITTER_URL
const mediumURL = process.env.MEDIUM_URL
const youtubeURL = process.env.YOUTUBE_URL
const instagramURL = process.env.INSTAGRAM_URL

export default function Footer({ locale }) {
  return (
    <>
      <footer>
        <div className="container">
          <div className="d-flex align-items-center justify-content-center">
            <div className="">
              <nav className="nav d-flex justify-content-center">
                <a
                  href={analyticsURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                  onClick={() => {
                    analytics.track('Analytics Link click')
                  }}
                >
                  {fbt('Analytics', 'Analytics link')}
                </a>
                <a
                  href={jobsURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                  onClick={() => {
                    analytics.track('Jobs Link click')
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
                    analytics.track('Docs Link click')
                  }}
                >
                  {fbt('Docs', 'Documentation link')}
                </a>
                <a
                  href={discordURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                  onClick={() => {
                    analytics.track('Discord Link click')
                  }}
                >
                  {fbt('Discord', 'Discord link')}
                </a>
                <a
                  href={githubURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                  onClick={() => {
                    analytics.track('Github Link click')
                  }}
                >
                  {fbt('Github', 'Github link')}
                </a>
              </nav>
              <div className="legal d-flex flex-column align-items-center">
                <a
                  href="https://originprotocol.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {fbt(
                    'Originally released by Origin Protocol',
                    'Originally released by Origin Protocol'
                  )}
                </a>
                <nav className="nav d-flex">
                  <a
                    href={termsURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-link"
                  >
                    {fbt('Terms of Service', 'Terms of Service')}
                  </a>
                  <a
                    href={privacyURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-link"
                  >
                    {fbt('Privacy Policy', 'Privacy Policy')}
                  </a>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </footer>
      <style jsx>{`
        footer {
          background-color: #061d2a;
          padding: 100px 0 160px 0;
        }

        h5 {
          color: white;
          font-size: 1.125rem;
          font-weight: bold;
        }

        p {
          color: #bdcbd5;
          font-size: 1.125rem;
        }

        a,
        .legal {
          color: white;
          font-size: 0.875rem;
        }

        .nav,
        .legal {
          margin-top: 20px;
        }

        a:hover {
          cursor: pointer;
          opacity: 0.8;
        }

        .nav-link {
          padding: 0;
        }

        .nav-link:not(:last-of-type) {
          padding-right: 32px;
        }

        .legal,
        .legal .nav-link {
          color: #bdcbd5;
          line-height: 2;
        }

        @media (max-width: 799px) {
          .container {
            padding-left: 30px;
            padding-right: 30px;
          }

          .col-12 {
            padding-right: 0px;
            padding-left: 0px;
          }

          footer {
            padding: 50px 10px;
          }

          .nav-link {
            min-width: 110px;
            margin-bottom: 20px;
          }
        }
      `}</style>
    </>
  )
}
