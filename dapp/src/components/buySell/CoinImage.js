const CoinImage = ({ small, coin, isSemiTransparent = false }) => {
  const className = `coin-image ${isSemiTransparent ? 'transparent' : ''}`
  return (
    <div className="d-flex align-items-center">
      {coin !== 'mix' && (
        <img
          className={`${className} ${small ? 'small' : ''}`}
          src={`/images/currency/${coin}-icon-small.svg`}
        />
      )}
      {coin === 'mix' && (
        <div className="d-flex align-items-start">
          <img
            className={`${className} mixed coin-1 ${small ? 'small' : ''}`}
            src={`/images/currency/dai-icon-small.svg`}
          />
          <img
            className={`${className} mixed coin-2 ${small ? 'small' : ''}`}
            src={`/images/currency/usdt-icon-small.svg`}
          />
          <img
            className={`${className} mixed coin-3 ${small ? 'small' : ''}`}
            src={`/images/currency/usdc-icon-small.svg`}
          />
        </div>
      )}
      <style jsx>{`
        .coin-image {
          width: 26px;
          height: 26px;
        }

        .coin-image.transparent {
          opacity: 0.3;
        }

        .coin-image.small {
          width: 14px;
          height: 14px;
        }

        .mixed {
          position: relative;
        }

        .coin-1 {
          z-index: 1;
        }

        .coin-2 {
          z-index: 2;
          margin-left: -9px;
        }

        .coin-3 {
          z-index: 3;
          margin-left: -9px;
        }
      `}</style>
    </div>
  )
}

export default CoinImage
