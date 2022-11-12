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
        <div className="max-w-screen-2xl mx-auto relative overflow-hidden px-8 lg:px-[134px] py-10 lg:pt-32 lg:pb-10 divide-[#ffffff33] divide-y-2 text-white">
          <div className="flex flex-col lg:flex-row justify-between pb-10 lg:pb-[88px] text-left">
            <img
              src={assetRootPath(`/images/origin-white.svg`)}
              className="w-28 lg:w-32 mb-10 lg:mb-0"
            />
            <div className="flex flex-col lg:flex-row justify-between">
              <a
                href={'https://governance.ousd.com/'}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 lg:mr-10"
                onClick={() => {
                  analytics.track('Governance Link click')
                }}
              >
                <Typography.Body3 className="text-[#fafbfb]">
                  {fbt('Governance', 'Governance link')}
                </Typography.Body3>
              </a>
              <a
                href={process.env.DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 lg:mr-10 mt-[20px] lg:mt-0"
                onClick={() => {
                  analytics.track('Docs Link click')
                }}
              >
                <Typography.Body3 className="text-[#fafbfb]">
                  {fbt('Docs', 'Documentation link')}
                </Typography.Body3>
              </a>
              <a
                href={'/blog'}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 lg:mr-10 mt-[20px] lg:mt-0"
                onClick={() => {
                  analytics.track('Blog Link click')
                }}
              >
                <Typography.Body3 className="text-[#fafbfb]">
                  {fbt('Blog', 'Blog link')}
                </Typography.Body3>
              </a>
              {/*<a
                href={'/faq'}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 lg:mr-10 mt-[20px] lg:mt-0"
                onClick={() => {
                  analytics.track('FAQ Link click')
                }}
              >
                <Typography.Body3 className="text-[#fafbfb]">
                  {fbt('FAQ', 'FAQ link')}
                </Typography.Body3>
              </a>*/}
              <a
                href={
                  'https://www.coingecko.com/en/coins/origin-dollar-governance'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 mr-10 mt-[20px] lg:mt-0"
                onClick={() => {
                  analytics.track('OGV Link click')
                }}
              >
                <Typography.Body3 className="text-[#fafbfb]">
                  {fbt('OGV', 'OGV link')}
                </Typography.Body3>
              </a>
              <br className="block lg:hidden" />
              <a
                href="/swap"
                target="_blank"
                rel="noopener noreferrer"
                className="gradient2 w-full lg:w-[126px] px-6 py-[6px] mt-[20px] lg:mt-0 rounded-full text-center"
              >
                <Typography.Body3 className="font-medium text-white">
                  Get OUSD
                </Typography.Body3>
              </a>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row justify-between pt-8 lg:pt-10 text-[#b5beca]">
            <a
              href="https://originprotocol.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Typography.Caption2>
                {fbt(
                  'Originally released by Origin Protocol',
                  'Originally released by Origin Protocol'
                )}
              </Typography.Caption2>
            </a>
            <div className="flex flex-row lg:justify-between mt-2 lg:mt-0">
              <a
                href={termsURL}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-4 lg:mr-0"
              >
                <Typography.Caption2>
                  {fbt('Terms of Service', 'Terms of Service')}
                </Typography.Caption2>
              </a>
              <a href={privacyURL} target="_blank" rel="noopener noreferrer">
                <Typography.Caption2>
                  {fbt('Privacy Policy', 'Privacy Policy')}
                </Typography.Caption2>
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
