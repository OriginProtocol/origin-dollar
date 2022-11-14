import { Card, Select } from '@originprotocol/origin-storybook'
import Image from 'next/image'
import React, { useEffect, useState } from 'react'
import { assetRootPath } from 'utils/image'
import { capitalize } from 'lodash'

const Category = ({ categories, setCategory }) => {
  const categoriesFormatted = [
    {
      id: null,
      name: 'All articles',
      unavailable: false,
    },
  ].concat(
    categories.map((category) => {
      return {
        id: category.slug,
        name: capitalize(category.name),
        unavailable: false,
      }
    })
  )

  return (
    <div className="pl-0 w-96 pt-4 text-black">
      <Select
        options={categoriesFormatted}
        onSelect={(value) => {
          setCategory(value.id)
        }}
      />
    </div>
  )
}

const News = ({ articles, meta, categories }) => {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(true)
  }, [])

  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [pageNumbers, setPageNumbers] = useState([])

  const articlePages = Math.ceil(
    (category
      ? articles.filter((article) => article.slug === category.slug).length
      : meta.pagination.total) / 9
  )
  const currentPageArticles = articles
    ? articles.slice(9 * (page - 1), 9 * page)
    : []

  useEffect(() => {
    const pages = articlePages

    let pageNumbers = [1, 2, pages, pages - 1, page, page - 1, page + 1]
    pageNumbers = pageNumbers.filter((number) => number > 0 && number <= pages)
    pageNumbers = [...new Set(pageNumbers)]
    pageNumbers = pageNumbers.sort((a, b) => a - b)
    setPageNumbers(pageNumbers)
  }, [page, articlePages])

  return (
    <>
      {loaded && currentPageArticles && (
        <div className="container-fluid max-w-screen-xl mx-auto px-6">
          <Category
            categories={categories}
            category={category}
            setCategory={setCategory}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-5 max-w-screen-xl mx-auto px-6 md:px-0">
            {currentPageArticles.map((a, i) => {
              if (!category || category === a.category.slug) {
                return (
                  <Card
                    webProperty={'ousd'}
                    title={a.title}
                    img={
                      <Image
                        src={
                          a.cardCover?.url ||
                          a.cover?.url ||
                          assetRootPath('/images/logos/origin-press.svg')
                        }
                        alt={a.cover?.alternativeText}
                        layout="fill"
                        objectFit="cover"
                      />
                    }
                    body={a.description}
                    linkText={'Read more'}
                    linkHref={`/${a.slug}`}
                    key={a.title}
                  />
                )
              }
            })}
          </div>
          <div className="pagination flex justify-center">
            {pageNumbers.map((pageNumber, index) => {
              const isCurrent = pageNumber === page
              const skippedAPage =
                index > 0 && pageNumber - pageNumbers[index - 1] !== 1

              return (
                <div className="flex" key={pageNumber}>
                  {skippedAPage && (
                    <div className="page-skip flex items-center justify-center">
                      ...
                    </div>
                  )}
                  <div
                    className={`page-number ${
                      isCurrent ? 'current' : ''
                    } flex items-center justify-center`}
                    onClick={() => {
                      if (isCurrent) {
                        return
                      }
                      setPage(pageNumber)
                    }}
                  >
                    {pageNumber}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <style jsx>{`
        .pagination {
          padding: 40px;
          border-radius: 10px;
        }

        .page-number {
          cursor: pointer;
          color: #8293a4;
          min-width: 40px;
          min-height: 40px;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          margin-right: 10px;
          font-size: 14px;
          cursor: pointer;
          padding-left: 15px;
          padding-right: 15px;
        }

        .page-skip {
          color: #8293a4;
          margin-right: 10px;
          min-width: 40px;
          min-height: 40px;
        }

        .page-number.current,
        .page-number.current:hover {
          background-color: #1a82ff;
          color: white;
        }

        .page-number:hover {
          background-color: #edf2f5;
        }

        @media (max-width: 799px) {
          .container {
            display: grid;
            grid-template-columns: repeat(1, 1fr);
            grid-gap: 5vw;
          }
        }
      `}</style>
    </>
  )
}

export default News
