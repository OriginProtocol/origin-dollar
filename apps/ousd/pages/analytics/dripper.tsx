import Head from "next/head";
import { GetServerSideProps } from "next";
import { Typography } from "@originprotocol/origin-storybook";
import {
  ErrorBoundary,
  LayoutBox,
  TwoColumnLayout,
} from "../../src/components";

// TODO: Dripper Port
const AnalyticsDripper = () => {
  return (
    <ErrorBoundary>
      <Head>
        <title>Analytics | Dripper</title>
      </Head>
      <div className="flex flex-col w-full h-full space-y-10">
        <Typography.Caption className="text-subheading">
          When yield is generated, it does not immediately get distributed to
          users’ wallets. It first goes through the Dripper, which releases the
          yield steadily over time. Raw yield is often generated at irregular
          intervals and in unpredictable amounts. The Dripper streams this yield
          gradually for a smoother and more predictable APY.
        </Typography.Caption>
        <div className="flex flex-col w-full space-y-6">
          <Typography.Caption>Dripper funds</Typography.Caption>
          <div className="flex flex-row space-x-1">
            <LayoutBox className="rounded-tr-none rounded-br-none">1</LayoutBox>
            <LayoutBox className="rounded-tl-none rounded-bl-none">2</LayoutBox>
          </div>
        </div>
        <div className="flex flex-col w-full space-y-6">
          <Typography.Caption>Dripper Rate</Typography.Caption>
          <div className="flex flex-row space-x-1">
            <LayoutBox className="rounded-tr-none rounded-br-none">1</LayoutBox>
            <LayoutBox className="rounded-tl-none rounded-bl-none">2</LayoutBox>
          </div>
        </div>
        <div className="flex flex-col w-full space-y-6">
          <Typography.Caption>Yield in, yield out</Typography.Caption>
          <Typography.Body2 className="text-subheading">
            View the amount of yield of yield the protocol earns Vs what is
            distributed after it’s processed by the dripper
          </Typography.Body2>
          <div className="flex flex-col space-y-4">
            <LayoutBox>1</LayoutBox>
            <div className="flex items-center justify-center">button here</div>
            <LayoutBox>2</LayoutBox>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export const getServerSideProps: GetServerSideProps = async (): Promise<{
  props;
}> => {
  return {
    props: {},
  };
};

export default AnalyticsDripper;

AnalyticsDripper.getLayout = (page, props) => (
  <TwoColumnLayout {...props}>{page}</TwoColumnLayout>
);
