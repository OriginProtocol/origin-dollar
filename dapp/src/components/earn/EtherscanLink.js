import React from 'react'

export default function EtherscanLink({ href, text, className }) {
  return (
    <>
      <a
        className={`d-flex align-items-center ehterscan-link ${className}`}
        target="_blank"
        rel="noopener noreferrer"
        href={href}
      >
        <img className="ehterscan-icon" src="/images/etherscan-icon-earn.svg" />
        {text}
      </a>
      <style jsx>{`
        .ehterscan-link {
          font-family: Lato;
          font-size: 14px;
          color: #8293a4;
          font-size: 14px;
          padding-bottom: 1px;
        }

        .ehterscan-link:hover {
          border-bottom: 1px solid #8293a4;
          padding-bottom: 0px;
        }

        .ehterscan-icon {
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
