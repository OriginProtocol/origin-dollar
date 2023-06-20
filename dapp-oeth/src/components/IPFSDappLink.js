import React, { useEffect, useState } from 'react'
import { fbt } from 'fbt-runtime'

export default function IPFSDappLink({ css }) {
  const [displayIpfsLink, setDisplayIpfsLink] = useState(false)

  useEffect(() => {
    setDisplayIpfsLink(process.env.DEPLOY_MODE !== 'ipfs')
  }, [])

  if (!displayIpfsLink) {
    return null
  }

  return (
    <div className={css}>
      <a
        className={`ipfs-link d-flex justify-content-center align-items-center`}
        href={process.env.NEXT_PUBLIC_IPFS_DAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="d-none d-md-block">
          {fbt('View on IPFS', 'View on IPFS')}
        </span>
        <span className="d-md-none">{fbt('IPFS', 'IPFS')}</span>
      </a>
      <style jsx>{`
        .ipfs-link {
          border-radius: 56px;
          margin-right: 10px;
          background-color: #1e1f25;
          color: #fafbfb;
          font-size: 16px;
          font-weight: 500;
          letter-spacing: 0em;
          text-align: left;
          height: 42px;
        }

        .ipfs-link span {
          padding: 8px 24px;
        }

        .ipfs-image {
          height: 10px;
          margin-right: 7px;
        }

        @media (max-width: 992px) {
          .ipfs-link {
            border-radius: 56px;
            margin-right: 10px;
            background-color: #1e1f25;
            color: #fafbfb;
            padding: 0;
            height: 36px;
          }

          .ipfs-link span {
            padding: 8px 16px;
            font-size: 12px;
          }

          .ipfs-image {
            height: 10px;
            margin-right: 7px;
          }
        }
      `}</style>
    </div>
  )
}
