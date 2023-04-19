import Head from "next/head";
import Image from "next/image";
import { GetServerSideProps } from "next";
import { groupBy, orderBy } from "lodash";
import { Typography } from "@originprotocol/origin-storybook";
import {
  Button,
  ErrorBoundary,
  LayoutBox,
  TwoColumnLayout,
  ProgressBar,
} from "../../src/components";
import { fetchAllocation } from "../../lib/allocation";
import { strategyMapping } from "../../src/utils/constants";
import { formatCurrency } from "../../src/utils/math";

const protocolToDetails = {
  Morpho: {
    description: `Morpho adds a peer-to-peer layer on top of Compound and Aave allowing
          lenders and borrowers to be matched more efficiently with better
          interest rates. When no matching opportunity exists, funds flow
          directly through to the underlying protocol. OUSD supplies stablecoins
          to three of Morpho&apos;s Compound markets to earn interest. Additional
          yield is generated from protocol token incentives, including both COMP
          (regularly sold for USDT) and MORPHO (currently locked).`,
    logoSrc: "/images/morpho-strategy.svg",
    color: "#9BC3E9",
  },
  Convex: {
    description: `Convex allows liquidity providers and stakers to earn greater rewards
          from Curve, a stablecoin-centric automated market maker (AMM). OUSD
          earns trading fees and protocol token incentives (both CRV and CVX).
          This strategy employs base pools and metapools, including the Origin
          Dollar factory pool, which enables OUSD to safely leverage its own
          deposits to multiply returns and maintain the pool’s balance.`,
    logoSrc: "/images/convex-strategy.svg",
    color: "#FF5A5A",
  },
  Aave: {
    description: `Aave is a liquidity protocol where users can participate as suppliers
          or borrowers. Each loan is over-collateralized to ensure repayment.
          OUSD deploys stablecoins to three of the Aave V2 markets and earns
          interest approximately every 12 seconds. Additional yield is generated
          from protocol token incentives (AAVE), which are regularly sold for
          USDT on Uniswap and compounded.`,
    logoSrc: "/images/aave-strategy.svg",
    color: "#7A26F3",
  },
  Compound: {
    description: `Compound is an interest rate protocol allowing lenders to earn yield
          on digital assets by supplying them to borrowers. Each loan is
          over-collateralized to ensure repayment. OUSD deploys stablecoins to
          three of the Compound V2 markets and earns interest approximately
          every 12 seconds. Additional yield is generated from protocol token
          incentives (COMP), which are regularly sold for USDT on Uniswap and
          compounded.`,
    logoSrc: "/images/compound-strategy.svg",
    color: "#00D592",
  },
};

const YieldSourceBreakdown = ({ data, total }) => (
  <div className="flex flex-col lg:flex-row flex-wrap lg:items-center gap-0 lg:gap-4">
    {data.map(({ icon, name, total: currentTotal }) => {
      return (
        <div
          key={name}
          className="flex flex-row items-center space-x-3 h-[40px]"
        >
          <Image src={icon} height={24} width={24} alt={name} />
          <Typography.Caption>{name}</Typography.Caption>
          <Typography.Caption className="text-subheading">
            {((currentTotal / total) * 100).toFixed(2)}%
          </Typography.Caption>
        </div>
      );
    })}
  </div>
);

const LookingForYield = () => {
  return (
    <LayoutBox>
      <div className="flex flex-col space-y-6 p-8">
        <Typography.Body>
          Looking for a full breakdown of where the yield comes from?
        </Typography.Body>
        <Typography.Body2 className="text-subheading text-sm">
          OUSD’s yield is transparent, real and 100% verifiable on-chain. See
          the evidence of OUSD’s consistent performance over the past X days.
        </Typography.Body2>
        <footer>
          <a
            href="https://www.ousd.com/ogv-dashboard"
            target="_blank"
            rel="noreferrer"
          >
            <Button
              append={
                <Image
                  src="/images/ext-link-white.svg"
                  height={16}
                  width={16}
                  alt="External link icon"
                />
              }
            >
              <Typography.Body2>View OUSD Proof of Yield</Typography.Body2>
            </Button>
          </a>
        </footer>
      </div>
    </LayoutBox>
  );
};

const AnalyticsStrategies = ({ protocols, total }) => {
  return (
    <ErrorBoundary>
      <Head>
        <title>Analytics | Strategies</title>
      </Head>
      <div className="grid grid-cols-12 gap-6">
        {protocols.map(({ name, strategies, total: strategyTotal }) => {
          const { logoSrc, description, color } = protocolToDetails[name] || {};
          if (!description) return null;
          return (
            <LayoutBox key={name} className="col-span-12">
              <div className="flex flex-col items-start space-y-6 p-8 w-full">
                <div className="flex justify-between w-full">
                  <img
                    src={logoSrc}
                    className="h-[32px]"
                    alt={`${name} Logo`}
                  />
                  <div className="flex flex-row space-x-2">
                    <Typography.Body className="text-subheading">
                      ${formatCurrency(strategyTotal, 2)}
                    </Typography.Body>
                    <Typography.Body>
                      ({((strategyTotal / total) * 100).toFixed(2)}%)
                    </Typography.Body>
                  </div>
                </div>
                <ProgressBar
                  color={color}
                  numerator={(strategyTotal / total) * 100}
                  denominator={100}
                />
                <YieldSourceBreakdown data={strategies} total={total} />
                <Typography.Caption className="text-subheading">
                  {description}
                </Typography.Caption>
              </div>
            </LayoutBox>
          );
        })}
        <div className="col-span-12">
          <LookingForYield />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export const getServerSideProps: GetServerSideProps = async (): Promise<{
  props;
}> => {
  const { strategies } = await fetchAllocation();

  // Split strategies into separate yield sources by token
  const yieldSources = Object.keys(strategies)
    .flatMap((strategy) => {
      if (!strategyMapping[strategy]) return null;
      if (strategyMapping[strategy]?.singleAsset) {
        if (!strategies[strategy]?.holdings) return null;
        return Object.keys(strategies[strategy]?.holdings).map((token) => {
          if (token === "COMP") return null;
          const name = `${strategyMapping[strategy].name} ${token}`;
          const protocol = strategyMapping[strategy]?.protocol;
          return {
            name: name,
            protocol: protocol,
            total: strategies[strategy]?.holdings[token],
            icon: `/images/tokens/${(protocol === "Morpho"
              ? name.replace("Morpho ", "")
              : name
            )
              .replace(/\s+/g, "-")
              .toLowerCase()}.svg`,
          };
        });
      }
      return {
        name: strategyMapping[strategy]?.name,
        protocol: strategyMapping[strategy]?.protocol,
        total: strategies[strategy]?.total,
        icon: strategyMapping[strategy]?.icon || null,
      };
    })
    .filter((strategy) => !!strategy.protocol);

  const protocols = groupBy(yieldSources, "protocol");

  const sumTotal = (values) =>
    values.reduce((t, s) => {
      return { total: t.total + s.total };
    })?.total;

  return {
    props: {
      protocols: orderBy(
        Object.keys(protocols)?.map((protocol) => ({
          name: protocol,
          strategies: protocols[protocol],
          total: sumTotal(protocols[protocol]),
        })),
        "total",
        "desc"
      ),
      total: sumTotal(yieldSources),
    },
  };
};

export default AnalyticsStrategies;

AnalyticsStrategies.getLayout = (page, props) => (
  <TwoColumnLayout {...props}>{page}</TwoColumnLayout>
);
