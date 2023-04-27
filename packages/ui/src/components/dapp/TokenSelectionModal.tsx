import { useRef } from 'react';
import { map } from 'lodash';
import { useClickAway, useKey, useLockBodyScroll } from '@originprotocol/hooks';
import { formatWeiBalance } from '@originprotocol/utils';
import TokenImage from '../core/TokenImage';

type TokenSelectProps = {
  tokens: any;
  onClose: any;
  onSelect: any;
};

const TokenSelectionModal = ({
  tokens,
  onClose,
  onSelect,
}: TokenSelectProps) => {
  const ref = useRef(null);

  useKey('Escape', onClose);

  useClickAway(ref, () => {
    setTimeout(() => {
      onClose();
    }, 100);
  });

  useLockBodyScroll(true);

  return (
    <div className="fixed z-[9999] top-0 left-0 flex flex-col h-[100vh] w-[100vw] items-center justify-center">
      <div className="absolute top-0 left-0 flex flex-col h-full w-full bg-origin-bg-black bg-opacity-90 z-[1]" />
      <div
        ref={ref}
        className="flex flex-col mx-auto max-h-[60vh] w-full lg:w-[50vw] z-[2] bg-origin-bg-lgrey rounded-xl p-6 overflow-auto"
      >
        {map(tokens, (token, key) => {
          const { address, logoSrc, name, symbol, balanceOf } = token;
          return (
            <button
              key={key}
              className="flex flex-row flex-shrink-0 w-full justify-between p-2 hover:bg-origin-bg-dgrey duration-100 ease-in transition-all rounded-md opacity-70 hover:opacity-100 hover:shadow-md"
              onClick={onSelect.bind(null, address)}
            >
              <div className="flex flex-row space-x-4 text-left items-center">
                <div className="flex items-center flex-shrink-0 w-[40px] h-[40px] rounded-full overflow-hidden">
                  <TokenImage
                    src={logoSrc}
                    symbol={symbol}
                    name={name}
                    height={40}
                    width={40}
                  />
                </div>
                <div className="flex flex-col space-y-2">
                  <p className="focus:outline-none bg-transparent text-2xl font-semibold caret-gradient1-from">
                    {name}
                  </p>
                  <span className="text-origin-dimmed">{symbol}</span>
                </div>
              </div>
              <div className="flex flex-col space-y-2 justify-end text-right">
                <p className="focus:outline-none bg-transparent text-2xl font-semibold caret-gradient1-from">
                  {balanceOf
                    ? parseFloat(formatWeiBalance(balanceOf)).toFixed(6)
                    : 0}
                </p>
                <span className="text-origin-dimmed text-lg">
                  {/*${balanceOf * (conversions[swap.from?.asset] || 0)}*/}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TokenSelectionModal;
