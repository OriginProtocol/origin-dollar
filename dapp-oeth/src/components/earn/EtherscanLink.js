import React from 'react'
import { assetRootPath } from 'utils/image'

export default function EtherscanLink({
  href,
  text,
  className,
  white = false,
}) {
  return (
    <>
      <a
        className={`d-flex align-items-center etherscan-link ${className} ${
          white ? 'white' : ''
        }`}
        target="_blank"
        rel="noopener noreferrer"
        href={href}
      >
        <img
          className="etherscan-icon"
          src={assetRootPath(
            `/images/${
              white ? 'etherscan-icon-white.svg' : 'etherscan-icon-earn.svg'
            }`
          )}
        />
        {text}
      </a>
      <style jsx>{`
        .etherscan-link {
          font-family: Lato;
          font-size: 14px;
          color: #8293a4;
          font-size: 14px;
        }

        .etherscan-link.white {
          color: white;
          opacity: 0.7;
        }

        .etherscan-link:hover {
          opacity: 0.8;
        }

        .etherscan-link.white:hover {
          border-color: white;
        }

        .etherscan-icon {
          width: 15px;
          height: 15px;
          margin-right: 9px;
        }

        .mr-29 {
          margin-right: 29px;
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </>
  )
}
