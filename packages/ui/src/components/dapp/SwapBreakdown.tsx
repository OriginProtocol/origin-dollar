import cx from 'classnames';
import {
  findTokenByAddress,
  formatUnits,
  formatUSD,
} from '@originprotocol/utils';
import TokenImage from '../core/TokenImage';

type SwapBreakdownProps = {
  breakdown: any;
  tokens: any;
  conversion: any;
};

const SwapBreakdown = ({
  breakdown,
  tokens,
  conversion,
}: SwapBreakdownProps) => {
  const breakdownKeys = Object.keys(breakdown || {});
  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
      <div className="flex flex-col items-center justify-center w-full p-4 lg:p-10">
        {breakdownKeys.map((contractAddress, index) => {
          const token = findTokenByAddress(tokens, contractAddress);
          if (!token) return null;
          const value = breakdown[contractAddress];
          // @ts-ignore
          const { logoSrc, name, symbolAlt, symbol, mix } = token;
          const convertedEstimateValue = conversion
            ? parseFloat(formatUnits(value, 18)) * conversion
            : 0;
          return (
            <div
              key={contractAddress}
              className={cx(
                'relative flex flex-row w-full items-center justify-center h-[100px] border border-t-[1px] border-origin-bg-lgrey px-4 lg:px-10 bg-origin-bg-grey',
                {
                  'rounded-tr-md rounded-tl-md': index === 0,
                  'rounded-br-md rounded-bl-md':
                    index === breakdownKeys?.length - 1,
                }
              )}
            >
              <div className="flex flex-row w-full h-full items-center justify-between space-y-2">
                <div className="flex flex-col space-y-2">
                  <span className="text-lg lg:text-2xl text-origin-white font-semibold">
                    {value ? parseFloat(formatUnits(value, 18)).toFixed(18) : 0}
                  </span>
                  <span className="text-origin-dimmed">
                    {formatUSD(convertedEstimateValue)}
                  </span>
                </div>
                <div className="flex flex-row space-x-3">
                  <TokenImage
                    src={logoSrc}
                    symbol={symbol}
                    name={name}
                    height={32}
                    width={32}
                    mix={mix}
                  />
                  <span className="text-2xl text-origin-white font-semibold">
                    {symbolAlt || symbol}
                  </span>
                </div>
              </div>
              <div
                className={cx(
                  'absolute bottom-[-18px] h-[36px] w-[36px] items-center justify-center',
                  {
                    hidden: index >= breakdownKeys?.length - 1,
                  }
                )}
                style={{ zIndex: index + 1 }}
              >
                <span className="flex font-header text-lg lg:text-2xl items-center text-origin-dimmed justify-center h-full w-full rounded-full border border-t-[1px] border-origin-bg-lgrey bg-origin-bg-grey">
                  +
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SwapBreakdown;
