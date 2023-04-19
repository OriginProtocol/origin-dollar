import Head from "next/head";
import { ErrorBoundary, TwoColumnLayout } from "../../src/components";
import { GetServerSideProps } from "next";

const AnalyticsHolders = () => {
  return (
    <ErrorBoundary>
      <Head>
        <title>Analytics | Holders</title>
      </Head>
      <div>TODO: Holders Breakdown</div>
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

export default AnalyticsHolders;

AnalyticsHolders.getLayout = (page, props) => (
  <TwoColumnLayout {...props}>{page}</TwoColumnLayout>
);
