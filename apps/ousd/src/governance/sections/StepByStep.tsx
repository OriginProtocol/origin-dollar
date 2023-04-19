import { useState } from "react";
import Image from "next/image";
import { Typography } from "@originprotocol/origin-storybook";
import { Section } from "../../components";
import {
  Step1,
  Step2,
  Step3,
  Step4,
  Step5,
  LargeScreenChooser,
  SmallScreenChooser,
} from "../components";
import { assetRootPath } from "../../utils/image";
import { useOgv, useViewWidth } from "../../hooks";
import { getRewardsApy } from "../../utils/math";
import { lgSize, stakingDecayFactor } from "../../constants";
import { ActiveSmall } from "../types";

const titles = [
  "Buy OGV",
  "Stake OGV",
  "Discuss a proposal",
  "Submit a proposal",
  "Vote on a proposal",
];

interface StepByStepProps {
  sectionOverrideCss?: string;
}

const StepByStep = ({ sectionOverrideCss }: StepByStepProps) => {
  const width = useViewWidth();
  const [activeLarge, setActiveLarge] = useState(1);
  const [activeSmall, setActiveSmall] = useState<ActiveSmall>({
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
  });

  const { totalVeSupply } = useOgv();
  const stakingApy =
    getRewardsApy(
      100 * stakingDecayFactor ** (48 / 12),
      100,
      parseFloat(totalVeSupply)
    ) || 0;

  return (
    <Section
      className={sectionOverrideCss}
      innerDivClassName="relative gradient3a py-10 px-6 lg:py-16 lg:px-20 rounded-lg overflow-hidden"
    >
      <Image
        src={assetRootPath("/images/splines19.png")}
        width="700"
        height="700"
        alt="splines"
        className="absolute bottom-0 left-0 max-w-[300px] max-h-[300px] -translate-x-1/2 translate-y-1/2 lg:max-w-[500px] lg:max-h-[500px] xl:max-w-[700px] xl:max-h-[700px] pointer-events-none"
      />

      <Typography.H6 className="font-normal">
        Step-by-step guide for creating proposals and voting
      </Typography.H6>

      {/* Content after title */}
      <div className="mt-14 flex">
        {/* Step Chooser */}
        {width >= lgSize ? (
          <LargeScreenChooser
            active={activeLarge}
            setActive={setActiveLarge}
            titles={titles}
          />
        ) : (
          <SmallScreenChooser
            active={activeSmall}
            setActive={setActiveSmall}
            stakingApy={stakingApy}
            titles={titles}
          />
        )}

        {/* Content */}
        {width >= lgSize && (
          <div className="ml-20">
            {
              {
                1: <Step1 />,
                2: <Step2 stakingApy={stakingApy} />,
                3: <Step3 />,
                4: <Step4 />,
                5: <Step5 />,
              }[activeLarge]
            }
          </div>
        )}
      </div>
    </Section>
  );
};

export default StepByStep;
