import { useQuery } from 'react-query';
import { Typography } from '@originprotocol/origin-storybook';
import Image from 'next/image';

const Portfolio = ({ i18n, portfolio }) => {
  const { logoSrc, queryFn } = portfolio;

  const { isLoading, isError, data, error } = useQuery({
    queryKey: ['portfolio'],
    queryFn,
  });

  const { balance, lifetimeEarnings, pendingYield } = data || {};

  return (
    <div className="flex flex-col w-full h-[300px] bg-origin-bg-lgrey rounded-xl">
      <Typography.Body
        className="flex flex-shrink-0 px-10 h-[80px] items-center"
        as="h2"
      >
        {i18n('portfolio.title')}
      </Typography.Body>
      <div className="h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
      <div className="grid grid-cols-2 h-full">
        <div className="flex flex-col px-10 justify-center h-full space-y-2 border-r-[1px] border-origin-bg-dgrey">
          <Typography.H7 className="text-origin-dimmed">
            {i18n('portfolio.balance')}
          </Typography.H7>
          <div className="flex flex-row items-center space-x-4 w-full">
            <Typography.H4 as="h2" className="text-3xl font-semibold">
              {balance || '-'}
            </Typography.H4>
            <Image src={logoSrc} height={32} width={32} alt="Token Logo" />
          </div>
        </div>
        <div className="flex flex-col justify-center h-full space-y-2">
          <div className="grid grid-cols-1 h-full w-full">
            <div className="flex flex-col px-10 w-full h-full justify-center border-b-[1px] border-origin-bg-dgrey space-y-2">
              <Typography.Caption2 className="text-origin-dimmed">
                {i18n('portfolio.lifetimeEarnings')}
              </Typography.Caption2>
              <Typography.H7>{lifetimeEarnings || '-'}</Typography.H7>
            </div>
            <div className="flex flex-col px-10 w-full h-full justify-center space-y-2">
              <Typography.Caption2 className="text-origin-dimmed">
                {i18n('portfolio.pendingYield')}
              </Typography.Caption2>
              <Typography.H7>{pendingYield || '-'}</Typography.H7>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
