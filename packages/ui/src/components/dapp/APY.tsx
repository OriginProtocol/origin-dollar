import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from 'react-query';
import Image from 'next/image';
import { useClickAway } from '@originprotocol/hooks';

type APYProps = {
  i18n: any;
  stats: any;
};

const APY = ({ i18n, stats }: APYProps) => {
  const { data } = useQuery({
    queryKey: ['apy'],
    queryFn: stats?.queryFn,
  });

  const apyOptions = [
    {
      label: i18n('apy.7dLabel'),
      id: '7d',
      value: 1,
    },
    {
      label: i18n('apy.30dLabel'),
      id: '30d',
      value: 2,
    },
    {
      label: i18n('apy.60dLabel'),
      id: '60d',
      value: 3,
    },
    {
      label: i18n('apy.90dLabel'),
      id: '90d',
      value: 4,
    },
    {
      label: i18n('apy.365dLabel'),
      id: '365d',
      value: 5,
    },
  ];

  const [selectedAPY, setSelectedAPY] = useState('30d');

  const ref = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useClickAway(ref, () => {
    setTimeout(() => {
      setIsOpen(false);
    }, 100);
  });

  const selected = useMemo(() => {
    return apyOptions.find((item) => item.id === selectedAPY);
  }, [selectedAPY]);

  return (
    <div className="flex flex-col w-full h-[80px] lg:h-[300px] bg-origin-bg-lgrey rounded-xl">
      <h2 className="hidden lg:flex flex-shrink-0 px-10 h-[80px] items-center">
        {i18n('apy.title')}
      </h2>
      <div className="hidden lg:flex h-[1px] w-full border-b-[1px] border-origin-bg-dgrey" />
      <div className="flex flex-row lg:flex-col px-6 lg:px-10 items-center lg:items-start justify-center h-full space-y-2">
        <div className="flex flex-col w-full justify-center">
          <h2 className="flex lg:hidden flex-shrink-0">{i18n('apy.title')}</h2>
          <div className="relative flex flex-row items-center w-full space-x-3">
            <h3 className="text-origin-dimmed text-lg">{selected?.label}</h3>
            <div className="relative">
              <button
                onClick={() => {
                  setIsOpen(true);
                }}
                className="flex justify-center items-center w-[22px] h-[22px] bg-origin-white bg-opacity-10 rounded-full overflow-hidden"
              >
                <Image
                  className="relative top-[1px]"
                  src="/icons/angledown.png"
                  height={7}
                  width={10}
                  alt="angledown"
                />
              </button>
              {isOpen && (
                <div
                  ref={ref}
                  className="absolute top-[30px] right-[-22px] flex flex-col bg-origin-bg-lgrey z-[9999] shadow-xl border border-[1px] border-origin-bg-dgrey rounded-xl overflow-hidden"
                >
                  <div className="flex flex-col w-full space-y-2">
                    {apyOptions.map(({ label, value, id }) => (
                      <button
                        key={id}
                        className="flex items-center hover:bg-origin-bg-dgrey w-full h-[35px] px-4"
                        role="button"
                        onClick={() => {
                          setSelectedAPY(id);
                          setIsOpen(false);
                        }}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <h4 className="font-header text-2xl lg:text-4xl font-bold bg-gradient-to-r from-gradient1-from to-gradient1-to inline-block text-transparent bg-clip-text">
          {/* @ts-ignore */}
          {data?.[selectedAPY]?.toFixed(2)}%
        </h4>
      </div>
    </div>
  );
};

export default APY;
