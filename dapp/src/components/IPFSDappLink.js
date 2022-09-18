import React, { useEffect, useState } from 'react'
import { fbt } from 'fbt-runtime'
import { assetRootPath } from 'utils/image'

export default function IPFSDappLink({ dapp, css }) {
  const [displayIpfsLink, setDisplayIpfsLink] = useState(false)

  useEffect(() => {
    setDisplayIpfsLink(
      ['ousd.com', 'www.ousd.com'].includes(window.location.host) ||
        window.location.host.startsWith('localhost:') ||
        window.location.host.startsWith('ousd-staging')
    )
  }, [])

  return (
    <div className={`${!displayIpfsLink || !dapp ? 'd-none' : css}`}>
      <a
        className={`ipfs-link d-flex justify-content-center align-items-center`}
        href={process.env.IPFS_DAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          className="ipfs-image"
          src={assetRootPath('/images/folder-icon.svg')}
        />
        <span className="d-none d-lg-block">
          {fbt('View on IPFS', 'View on IPFS')}
        </span>
      </a>
      <style jsx>{`
        .ipfs-link {
          height: 30px;
          min-width: 30px;
          border-radius: 15px;
          border: solid 1px white;
          margin-right: 10px;
          color: white;
          padding: 0px 10px;
        }

        .ipfs-image {
          height: 10px;
          margin-right: 7px;
        }

        @media (max-width: 992px) {
          .ipfs-link {
            height: 24px;
            min-width: 24px;
            margin-right: 0;
            margin-left: 10px;
            padding: 0px;
          }

          .ipfs-image {
            height: 10px;
            margin-right: 0px;
          }
        }
      `}</style>
    </div>
  )
}
