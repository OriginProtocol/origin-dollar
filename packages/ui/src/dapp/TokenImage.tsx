import Image from 'next/image';

const TokenImage = ({ src = '', symbol, name, height = 24, width = 24 }) => (
  <Image
    className="overflow-hidden rounded-full"
    src={src || `/tokens/${symbol}.png`}
    height={height}
    width={width}
    alt={name}
  />
);

export default TokenImage;
