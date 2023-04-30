import Image from 'next/image';
import cx from 'classnames';

type TokenImageProps = {
  className?: string;
  height?: number;
  width?: number;
  src: string;
  symbol: string;
  name: string;
  mix?: string[];
};

const TokenImage = ({
  className = '',
  src,
  symbol,
  name,
  height = 24,
  width = 24,
  mix,
}: TokenImageProps) =>
  mix ? (
    <div
      className="relative flex flex-row items-center"
      style={{
        width: width + (mix.length - 1) * 15,
      }}
    >
      {mix?.map((mixSymbol, index) => (
        <div
          key={mixSymbol}
          className="absolute top-0 left-0 flex items-center"
          style={{
            zIndex: index + 1,
            left: (mix.length - 1) * 15,
            height,
            width,
          }}
        >
          <img
            src={`/tokens/${mixSymbol}.png`}
            className="flex relative rounded-full overflow-hidden"
            alt="Mixed asset"
            style={{ bottom: height / 2, left: (index * -1 * width) / 2 }}
          />
        </div>
      ))}
    </div>
  ) : (
    <Image
      className={cx('overflow-hidden rounded-full', className)}
      src={src || `/tokens/${symbol}.png`}
      height={height}
      width={width}
      alt={name}
    />
  );

export default TokenImage;
