import { useQuery } from 'react-query';
import { useAccount, useContractRead } from '@originprotocol/hooks';
import { formatWeiBalance } from '@originprotocol/utils';
import TokenImage from '../core/TokenImage';

type PortfolioProps = {
  i18n: any;
  portfolio: any;
};

type PortfolioResponse = {
  data: any;
};

const Portfolio = ({ i18n, portfolio }: PortfolioProps) => {
  const { token, queryFn } = portfolio;

  const { address } = useAccount();

  const { data: balance } = useContractRead({
    address: token.address,
    abi: token.abi,
    functionName: 'balanceOf',
    args: [address],
    watch: true,
  });

  const { data }: PortfolioResponse = useQuery({
    queryKey: ['portfolio', token.address],
    queryFn,
  });

  const { displayValues } = data || {};

  return (
    <div className="flex flex-col w-full lg:h-[300px] bg-origin-bg-lgrey rounded-xl">
      <h2 className="hidden lg:flex flex-shrink-0 px-10 h-[80px] items-center">
        {token?.symbol} {i18n('portfolio.title')}
      </h2>
      <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
      <div className="grid grid-cols-1 lg:grid-cols-2 h-full w-full">
        <div className="flex flex-row w-full lg:flex-col px-6 py-3 lg:px-10 items-center lg:items-start justify-center h-full space-y-2 border-b-[1px] lg:border-r-[1px] border-origin-bg-dgrey">
          <span className="text-origin-white text-base lg:text-origin-dimmed lg:text-lg">
            {i18n('portfolio.balance')}
          </span>
          <div className="flex flex-row items-center space-x-4 w-full justify-end lg:justify-center">
            <h3 className="font-header font-semibold text-xl lg:text-4xl order-2 lg:order-1 pl-3 lg:pl-0">
              {balance ? parseFloat(formatWeiBalance(balance)).toFixed(6) : '-'}
            </h3>
            <TokenImage
              className="order-1 lg:order-2 scale-90 lg:scale-100 flex-shrink-0 flex"
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
                className="flex flex-row lg:flex-col px-6 py-3 lg:px-10 w-full h-full items-center lg:items-start justify-between lg:justify-center border-b-[1px] border-origin-bg-dgrey space-y-2"
              >
                <label className="text-origin-dimmed text-sm">
                  {i18n(`portfolio.${valueKey}`)}
                </label>
                <span className="text-lg">
                  ${parseFloat(data?.[valueKey]).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
