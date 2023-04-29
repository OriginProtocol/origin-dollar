import Image from 'next/image';
import cx from 'classnames';

type TokenImageProps = {
  className?: string;
  height?: number;
  width?: number;
  src: string;
  symbol: string;
  name: string;
};

const TokenImage = ({
  className = '',
  src,
  symbol,
  name,
  height = 24,
  width = 24,
}: TokenImageProps) => (
  <Image
    className={cx('overflow-hidden rounded-full', className)}
    src={src || `/tokens/${symbol}.png`}
    height={height}
    width={width}
    alt={name}
  />
);

export default TokenImage;
