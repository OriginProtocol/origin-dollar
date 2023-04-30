import { MouseEventHandler } from 'react';
import Image from 'next/image';
import TokenImage from './TokenImage';

type SelectTokenPillProps = {
  symbol: string;
  name: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  logoSrc: string;
  readOnly?: boolean;
  mix?: string[];
  symbolAlt?: string;
};

const SelectTokenPill = ({
  logoSrc,
  symbol,
  name,
  onClick,
  readOnly,
  mix,
  symbolAlt,
}: SelectTokenPillProps) => {
  return (
    <button
      onClick={onClick}
      disabled={readOnly}
      className="relative flex flex-row items-center px-1 max-w-[200px] h-[40px] bg-origin-white bg-opacity-10 rounded-full overflow-hidden"
    >
      {!symbol ? (
        <span className="text-xs text-center w-full">...</span>
      ) : (
        <div className="flex flex-row items-center w-full h-full space-x-3 pr-2">
          <div className="flex items-center flex-shrink-0">
            <TokenImage
              src={logoSrc}
              symbol={symbol}
              name={name}
              height={30}
              width={30}
              mix={mix}
            />
          </div>
          <span className="flex font-semibold text-lg text-left flex-shrink-0">
            {symbolAlt || symbol}
          </span>
          {!readOnly && (
            <div className="flex flex-shrink-0 relative top-[2px] w-[20px]">
              <Image
                src="/icons/angledown.png"
                height={9}
                width={12}
                alt="angledown"
              />
            </div>
          )}
        </div>
      )}
    </button>
  );
};

export default SelectTokenPill;
