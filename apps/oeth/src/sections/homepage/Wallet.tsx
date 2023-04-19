import Image from 'next/image';
import { GradientButton, GrowingWallet, Section } from '../../components';
import { useViewWidth } from '../../hooks';
import { lgSize } from '../../../constants';
import { assetRootPath } from '../../utils';
import { Typography } from '@originprotocol/origin-storybook';
import { twMerge } from 'tailwind-merge';

const Wallet = () => {
  const width = useViewWidth();

  const bullets = [
    'Auto-compounding in your wallet',
    'Protocol-controlled liquidity',
    'Self-custodial, always liquid',
    'No staking or lock-ups',
  ];

  return (
    <Section className="bg-origin-bg-grey">
      {/* Wallet container */}
      <div className="bg-origin-bg-dgreyt w-full flex flex-col lg:flex-row rounded-lg lg:pr-16 relative">
        {width < lgSize && <OethList className="px-6 pt-6" bullets={bullets} />}
        <GrowingWallet className="mt-10 lg:mt-[72px] lg:mr-14 2xl:mr-[100px] py-3 ml-6 lg:ml-16" />
        {width >= lgSize && <OethList className="mt-20" bullets={bullets} />}
      </div>
    </Section>
  );
};

const OethList = ({
  bullets,
  className,
}: {
  bullets: string[];
  className?: string;
}) => {
  return (
    <div className={twMerge('lg:mb-20', className)}>
      <Typography.H5>More yields. Less hassle.</Typography.H5>
      <ul className="home-ul mt-8 ">
        {bullets.map((e, i) => (
          <li className="mt-4" key={i}>
            <Typography.Body>{e}</Typography.Body>
          </li>
        ))}
      </ul>
      <GradientButton outerDivClassName="mt-10" className="bg-origin-bg-dgrey">
        Learn More
      </GradientButton>
    </div>
  );
};

export default Wallet;
