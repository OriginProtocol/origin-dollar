import { MouseEventHandler } from 'react';
import Image from 'next/image';
import TokenImage from './TokenImage';

type SelectTokenPillProps = {
  symbol: string;
  name: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  logoSrc?: string;
  readOnly?: boolean;
};

const SelectTokenPill = ({
  logoSrc,
  symbol,
  name,
  onClick,
  readOnly,
}: SelectTokenPillProps) => (
  <button
    onClick={onClick}
    disabled={readOnly}
    className="relative flex flex-row items-center px-1 max-w-[160px] h-[40px] bg-origin-white bg-opacity-10 rounded-full overflow-hidden"
  >
    {!symbol ? (
      <span className="text-xs text-center w-full">...</span>
    ) : (
      <div className="flex flex-row items-center w-full h-full space-x-4 pr-2">
        <div className="flex items-center flex-shrink-0 w-[30px] h-full overflow-hidden">
          <TokenImage
            src={logoSrc}
            symbol={symbol}
            name={name}
            height={30}
            width={30}
          />
        </div>
        <span className="font-semibold text-xl w-full text-left">{symbol}</span>
        {!readOnly && (
          <Image
            className="flex flex-shrink-0 relative top-[2px] w-[12px]"
            src="/icons/angledown.png"
            height={9}
            width={12}
            alt="angledown"
          />
        )}
      </div>
    )}
  </button>
);

export default SelectTokenPill;
