import Moment from 'react-moment'
import Seo from './strapi/seo'
import { Typography, Header } from '@originprotocol/origin-storybook'
import Image from 'next/image'
import Link from 'next/link'
import styles from '../styles/Article.module.css'
import { assetRootPath } from 'utils/image'
import formatSeo from 'utils/seo'

const Article = ({ article, navLinks }) => {
  const imageUrl = article.cover?.url

  const seo = formatSeo(article.seo)

  return (
    <section className="intro black">
      <Seo seo={seo} />
      <Header mappedLinks={navLinks} webProperty="ousd" />
      <div className="max-w-screen-xl mx-auto">
        <Typography.Link className="flex space-x-2">
          <img
            src={assetRootPath('/images/left-arrow.svg')}
            className="ml-2"
            alt="left arrow"
          />
          <Link href="/company" className="ml-3">
            Back to home page
          </Link>
        </Typography.Link>
      </div>
      <div className="mb-6 mt-2 max-w-screen-xl mx-auto">
        <Typography.H7
          as="h1"
          className="text-[32px] md:text-[56px] leading-[36px] md:leading-[64px] font-bold"
        >
          {article.title}
        </Typography.H7>
      </div>
      <div className="max-w-screen-xl mx-auto bg-white rounded-2xl pb-10">
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
          <div className={`py-6 pl-6 pr-6 md:px-28 ${styles.article}`}>
            <div
              dangerouslySetInnerHTML={{
                __html: article.body,
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
                  <Moment format="MMM Do YYYY">{article.published_at}</Moment>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Article
