import Moment from 'react-moment'
import Seo from './strapi/seo'
import { Typography, Header } from '@originprotocol/origin-storybook'
import Image from 'next/image'
import Link from 'next/link'
import Layout from 'components/layout'
import styles from '../styles/Article.module.css'
import { assetRootPath } from 'utils/image'
import formatSeo from 'utils/seo'
import sanitizeHtml from 'sanitize-html'
import he from 'he'
import { sanitizationOptions } from 'utils/constants'

const Article = ({ locale, article, navLinks }) => {
  const imageUrl = article.cover?.url

  const seo = formatSeo(article.seo)

  return (
    <>
      <Seo seo={seo} />
      <Layout locale={locale}>
        <section className="page black">
          <Header mappedLinks={navLinks} webProperty="ousd" />
          <div className="max-w-screen-2xl mx-auto mt-[20px] md:mt-16 px-8 md:px-[134px] md:pb-40">
            <div className="mb-6 mt-2">
              <Typography.H6
                as="h1"
                className="text-[32px] md:text-[56px] leading-[36px] md:leading-[64px] font-bold"
              >
                {article.title}
              </Typography.H6>
            </div>
            <div className="bg-white rounded-2xl pb-10">
              {imageUrl && (
                <div
                  id="banner"
                  className="bg-cover flex justify-center items-center m-0 h-96 w-full rounded-tl-2xl rounded-tr-2xl relative overflow-hidden"
                  data-src={imageUrl}
                  data-srcset={imageUrl}
                >
                  <Image
                    src={imageUrl}
                    alt={article.cover?.alternativeText}
                    layout="fill"
                    objectFit="cover"
                    priority
                  />
                </div>
              )}
              <div className="pt-6 md:pt-12">
                <div className="py-6 pl-6 pr-6 md:px-28 text-black">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(
                        he.decode(article.body),
                        sanitizationOptions
                      ),
                    }}
                  />
                  <hr className="my-6" />
                  <div className="flex items-center">
                    <div>
                      {article.author?.avatar && (
                        <img
                          src={article.author.avatar.url}
                          alt={article.author.avatar.alternativeText}
                          style={{
                            position: 'static',
                            borderRadius: '20%',
                            height: 60,
                          }}
                          width="64px"
                          height="64px"
                        />
                      )}
                    </div>
                    <div className="ml-4 text-black">
                      {article.author?.name && <p>By {article.author.name}</p>}
                      <p>
                        <Moment format="MMM Do YYYY">
                          {article.published_at}
                        </Moment>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Layout>
    </>
  )
}

export default Article
