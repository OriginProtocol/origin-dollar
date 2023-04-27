import { useQuery } from 'react-query';
import TokenImage from './TokenImage';
import { useAccount, useContractRead } from '@originprotocol/hooks';
import { formatWeiBalance } from '@originprotocol/utils';

const Portfolio = ({ i18n, portfolio }) => {
  const { token, queryFn } = portfolio;

  const { address } = useAccount();

  const { data: balance } = useContractRead({
    address: token.address,
    abi: token.abi,
    functionName: 'balanceOf',
    args: [address],
    watch: true,
  });

  const { data } = useQuery({
    queryKey: ['portfolio', token.address],
    queryFn,
  });
  
  // @ts-ignore
  const { displayValues } = data || {};

  return (
    <div className="flex flex-col w-full h-[300px] bg-origin-bg-lgrey rounded-xl">
      <h2 className="flex flex-shrink-0 px-10 h-[80px] items-center">
        {token?.symbol} {i18n('portfolio.title')}
      </h2>
      <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
      <div className="grid grid-cols-2 h-full">
        <div className="flex flex-col px-10 justify-center h-full space-y-2 border-r-[1px] border-origin-bg-dgrey">
          <span className="text-origin-dimmed text-lg">
            {i18n('portfolio.balance')}
          </span>
          <div className="flex flex-row items-center space-x-4 w-full">
            <h3 className="font-header text-4xl">
              {balance ? parseFloat(formatWeiBalance(balance)).toFixed(6) : '-'}
            </h3>
            <TokenImage
              src={token?.logoSrc}
              height={32}
              width={32}
              name={token?.name}
              symbol={token?.symbol}
            />
          </div>
        </div>
        <div className="flex flex-col justify-center h-full space-y-2">
          <div className="grid grid-cols-1 h-full w-full">
            {displayValues?.map((valueKey: string) => (
              <div
                key={valueKey}
                className="flex flex-col px-10 w-full h-full justify-center border-b-[1px] border-origin-bg-dgrey space-y-2"
              >
                <label className="text-origin-dimmed text-sm">
                  {i18n(`portfolio.${valueKey}`)}
                </label>
                {/* @ts-ignore */}
                <span>${parseFloat(data?.[valueKey]).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
