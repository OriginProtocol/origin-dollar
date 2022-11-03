import { fbt } from 'fbt-runtime'
import analytics from 'utils/analytics'
import { getDocsLink } from 'utils/getDocsLink'
import { assetRootPath } from 'utils/image'
import { useRouter } from 'next/router'

import EmailForm from './EmailForm'
import { Typography } from '@originprotocol/origin-storybook'

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
  const { pathname } = useRouter()

  return (
    <>
      <footer>
        <div className="max-w-screen-xl mx-auto relative overflow-hidden px-8 pt-16 pb-10 divide-gray-500 divide-y-2 text-white">
          <div className="flex flex-col md:flex-row justify-between pt-10 pb-10 md:pb-16 text-left">
            <img
              src={assetRootPath(`/images/origin-white.svg`)}
              className="w-28 md:w-32 pb-6 md:pb-0"
            />
            <div className="flex flex-col md:flex-row justify-between mt-2 md:w-1/2">
              <a
                href={'https://governance.ousd.com/'}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2"
                onClick={() => {
                  analytics.track('Governance Link click')
                }}
              >
                <Typography.Body2>
                  {fbt('Governance', 'Governance link')}
                </Typography.Body2>
              </a>
              <a
                href={getDocsLink(locale)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2"
                onClick={() => {
                  analytics.track('Docs Link click')
                }}
              >
                <Typography.Body2>
                  {fbt('Docs', 'Documentation link')}
                </Typography.Body2>
              </a>
              <a
                href={'/blog'}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2"
                onClick={() => {
                  analytics.track('Blog Link click')
                }}
              >
                <Typography.Body2>{fbt('Blog', 'Blog link')}</Typography.Body2>
              </a>
              <a
                href={'/faq'}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2"
                onClick={() => {
                  analytics.track('FAQ Link click')
                }}
              >
                <Typography.Body2>{fbt('FAQ', 'FAQ link')}</Typography.Body2>
              </a>
              <a
                href={'https://www.coingecko.com/en/coins/origin-dollar-governance'}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2"
                onClick={() => {
                  analytics.track('OGV Link click')
                }}
              >
                <Typography.Body2>{fbt('OGV', 'OGV link')}</Typography.Body2>
              </a>
              <br className="block md:hidden" />
              <a
                href="/swap"
                target="_blank"
                rel="noopener noreferrer"
                className="bttn gradient2 px-4 py-2 w-full md:w-32 m-0"
              >
                <Typography.Body2>Get OUSD</Typography.Body2>
              </a>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between pt-10 opacity-75">
            <a
              href="https://originprotocol.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Typography.Caption>
                {fbt(
                  'Originally released by Origin Protocol',
                  'Originally released by Origin Protocol'
                )}
              </Typography.Caption>
            </a>
            <div className="flex flex-row md:justify-between mt-2 md:mt-0">
              <a
                href={termsURL}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-4 md:mr-0"
              >
                <Typography.Caption>
                  {fbt('Terms of Service', 'Terms of Service')}
                </Typography.Caption>
              </a>
              <a href={privacyURL} target="_blank" rel="noopener noreferrer">
                <Typography.Caption>
                  {fbt('Privacy Policy', 'Privacy Policy')}
                </Typography.Caption>
              </a>
            </div>
          </div>
        </div>
      </footer>
      <style jsx>{`
        footer {
          background-color: #141519;
          color: #fafbfb;
        }
      `}</style>
    </>
  )
}
