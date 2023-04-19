import React, { useEffect, useMemo, useState } from "react";
import { Typography } from "@originprotocol/origin-storybook";
import { twMerge } from "tailwind-merge";
import { Section } from "../../components";
import { RangeInput, RangeOutput } from "../components";
import { commify } from "ethers/lib/utils";
import {
  useBlock,
  useIntersectionObserver,
  useRefs,
  useViewWidth,
} from "../../hooks";
import { mdSize } from "../../constants";
import { veOgvToOgv } from "../utils";

interface CalculatorProps {
  sectionOverrideCss?: string;
}

const values = [1, 12, 24, 36, 48];

const lockupDurationInputMarkers = [
  {
    label: "1 month",
  },
  {
    label: "12 months",
  },
  {
    label: "24 months",
  },
  {
    label: "36 months",
  },
  {
    label: "48 months",
  },
].map((e, i) => ({ ...e, value: values[i] }));

const lockupDurationInputMarkersSmall = [
  {
    label: "1M",
  },
  {
    label: "12M",
  },
  {
    label: "24M",
  },
  {
    label: "36M",
  },
  {
    label: "48M",
  },
].map((e, i) => ({ ...e, value: values[i] }));

const Calculator = ({ sectionOverrideCss }: CalculatorProps) => {
  const width = useViewWidth();

  const [lockupDuration, setLockupDuration] = useState(1);
  const block = useBlock();
  const blockTimestamp = block?.timestamp;
  const snapshotReq = useMemo(
    () => veOgvToOgv(blockTimestamp, 10_000, lockupDuration),
    [blockTimestamp, lockupDuration]
  );
  const onChainReq = useMemo(
    () => veOgvToOgv(blockTimestamp, 1_000_000, lockupDuration),
    [blockTimestamp, lockupDuration]
  );

  const [firstViewIntervalId, setFirstViewIntervalId] =
    useState<NodeJS.Timeout>();
  const [firstView, setFirstView] = useState(false);
  const [targetRef] = useRefs<HTMLDivElement>(1);

  useIntersectionObserver(
    [targetRef],
    ([entry]) => {
      // Update the state when the target element intersects with the viewport
      if (entry.isIntersecting && !firstView) setFirstView(true);
    },
    { rootMargin: "0% 0% -50% 0px" }
  );

  // We want the animation to run only once... the first time the component is
  // viewed by the user.
  useEffect(() => {
    if (!firstView) return;

    const id = setInterval(() => {
      setLockupDuration((lockupDuration) => {
        if (lockupDuration >= 24) clearInterval(id);
        return lockupDuration + 1;
      });
    }, 100);

    setFirstViewIntervalId(id);
  }, [firstView]);

  return (
    <Section
      className={twMerge("py-20", sectionOverrideCss)}
      innerDivClassName="bg-origin-bg-black px-6 py-10 lg:py-16 lg:px-20 rounded-lg"
      ref={targetRef}
      onClick={() => clearInterval(firstViewIntervalId)}
    >
      {/* <div ref={targetRef}></div> */}
      <Typography.H6>OGV to veOGV calculator</Typography.H6>
      <Typography.Body2 className="mt-8">
        Select your staking period to see how much OGV is needed for Snapshot
        and on-chain proposals
      </Typography.Body2>

      <RangeInput
        label="Length of stake"
        markers={
          width >= mdSize
            ? lockupDurationInputMarkers
            : lockupDurationInputMarkersSmall
        }
        min={1}
        max={48}
        value={lockupDuration}
        onChange={(e) => setLockupDuration(parseInt(e.target.value))}
        onMarkerClick={(markerValue) =>
          markerValue && setLockupDuration(parseInt(markerValue))
        }
      />
      <div className="flex flex-col lg:flex-row w-full">
        <RangeOutput
          title="Snapshot proposal (10,000 veOGV)"
          value={commify(snapshotReq.toFixed(2))}
          className="w-full lg:w-1/2 mr-6"
        />
        <RangeOutput
          title="On-chain proposal (1,000,000 veOGV)"
          value={commify(onChainReq.toFixed(2))}
          className="w-full lg:w-1/2"
        />
      </div>
    </Section>
  );
};

export default Calculator;
