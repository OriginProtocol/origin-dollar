import { Typography } from "@originprotocol/origin-storybook";
import Head from "next/head";
import {
  ErrorBoundary,
  LayoutBox,
  TwoColumnLayout,
} from "../../src/components";

const monitoring = {
  macro: [
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=10",
      description: "",
    },
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=22",
      description: "",
    },
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=24",
      description: "",
    },
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=34",
      description: "",
    },
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=32",
      description: "",
    },
  ],
  statistics: [
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=26",
      description: "",
    },
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=2",
      description: "",
    },
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=4",
      description: "",
    },
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=28",
      description: "",
    },
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=30",
      description: "",
    },
  ],
  strategies: [
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=8",
      description: "",
    },
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=18",
      description: "",
    },
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=6",
      description: "",
    },
    {
      url: "https://ousd-dashboard.ogn.app/d-solo/0YIjaWh4z/main-dashboard?orgId=1&panelId=20",
      description: "",
    },
  ],
};

const AnalyticsHealthMonitoring = () => {
  return (
    <ErrorBoundary>
      <Head>
        <title>Analytics | Health Monitoring</title>
      </Head>
      <div className="flex flex-col w-full h-full space-y-10">
        <Typography.Caption className="text-subheading">
          Monitoring the health of DEFI contracts that can affect OUSD strategy
          health.
        </Typography.Caption>
        <div className="flex flex-col w-full space-y-6">
          <Typography.Caption>Macro situation</Typography.Caption>
          <div className="grid grid-cols-12 gap-6">
            {monitoring?.macro.map(({ url, description }) => (
              <div
                key={url}
                className="flex flex-col space-y-2 col-span-12 lg:col-span-6"
              >
                <LayoutBox className="min-h-[420px]">
                  <div className="w-full h-full space-y-2">
                    <iframe
                      src={url}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                    />
                  </div>
                </LayoutBox>
                {description && (
                  <div className="relative flex flex-col w-full bg-origin-bg-grey rounded-md p-6">
                    <Typography.Caption className="text-subheading">
                      {description}
                    </Typography.Caption>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="h-[3px] bg-origin-bg-grey w-full flex-shrink-0" />
        <div className="flex flex-col w-full space-y-6">
          <Typography.Caption>General statistics</Typography.Caption>
          <div className="grid grid-cols-12 gap-6">
            {monitoring?.statistics.map(({ url, description }) => (
              <div
                key={url}
                className="flex flex-col space-y-2 col-span-12 lg:col-span-6"
              >
                <LayoutBox className="min-h-[420px]">
                  <div className="w-full h-full space-y-2">
                    <iframe
                      src={url}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                    />
                  </div>
                </LayoutBox>
                {description && (
                  <div className="relative flex flex-col w-full bg-origin-bg-grey rounded-md p-6">
                    <Typography.Caption className="text-subheading">
                      {description}
                    </Typography.Caption>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="h-[3px] bg-origin-bg-grey w-full flex-shrink-0" />
        <div className="flex flex-col w-full space-y-6">
          <Typography.Caption>Strategies</Typography.Caption>
          <div className="grid grid-cols-12 gap-6">
            {monitoring?.strategies.map(({ url, description }) => (
              <div
                key={url}
                className="flex flex-col space-y-2 col-span-12 lg:col-span-6"
              >
                <LayoutBox className="min-h-[420px]">
                  <div className="w-full h-full space-y-2">
                    <iframe
                      src={url}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                    />
                  </div>
                </LayoutBox>
                {description && (
                  <div className="relative flex flex-col w-full bg-origin-bg-grey rounded-md p-6">
                    <Typography.Caption className="text-subheading">
                      {description}
                    </Typography.Caption>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AnalyticsHealthMonitoring;

AnalyticsHealthMonitoring.getLayout = (page, props) => (
  <TwoColumnLayout {...props}>{page}</TwoColumnLayout>
);
