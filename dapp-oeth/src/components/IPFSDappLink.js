import React, { useEffect, useState } from 'react'
import { fbt } from 'fbt-runtime'
import { assetRootPath } from 'utils/image'

export default function IPFSDappLink({ css }) {
  const [displayIpfsLink, setDisplayIpfsLink] = useState(false)

  useEffect(() => {
    setDisplayIpfsLink(
      ['app.oeth.com', '.herokuapp.com'].includes(window.location.host) ||
        window.location.host.startsWith('localhost:') ||
        window.location.host.startsWith('oeth-dapp-staging') ||
        window.location.host.startsWith('oeth-dapp')
    )
  }, [])

  return (
    <div className={`${!displayIpfsLink || css}`}>
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
          padding: 0px 10px;
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
          }

          .ipfs-link span {
            padding: 8px 16px;
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
