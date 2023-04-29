import Image from 'next/image';

type SwapRoutesProps = {
  i18n: any;
  selectedEstimate: any;
  estimates: any;
};

const SwapRoutes = ({ i18n, selectedEstimate, estimates }: SwapRoutesProps) => {
  const hasMoreRoutes = false;
  return (
    <div className="flex flex-col w-full bg-origin-bg-lgrey rounded-xl p-4 lg:p-10 space-y-3 lg:space-y-6">
      <h3 className="flex flex-shrink-0 items-center">{i18n('swapRoutes')}</h3>
      <div className="relative flex flex-col space-y-2 py-6 h-full w-full px-10 bg-origin-bg-grey rounded-md">
        <div className="flex flex-row space-x-2">
          <span>0 ETH</span>
          <span className="text-origin-dimmed">({i18n('estimate')})</span>
        </div>
        <div className="flex flex-row">
          <span className="text-origin-dimmed w-[150px]">-</span>
          <span className="text-origin-dimmed w-[150px]">-</span>
        </div>
      </div>
      {hasMoreRoutes && (
        <div className="flex flex-col w-full items-center justify-center">
          <button className="flex flex-row space-x-4 items-center justify-center w-[150px] py-1 bg-origin-white bg-opacity-10 rounded-full">
            <span>{i18n('show more')}</span>
            <Image
              className="relative top-[2px]"
              src="/icons/caretdown.png"
              height={6}
              width={8}
              alt="Caret down"
            />
          </button>
        </div>
      )}
    </div>
  );
};

export default SwapRoutes;
