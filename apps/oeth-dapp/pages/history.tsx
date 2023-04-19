import { ErrorBoundary, Layout } from "../src/components";
import React from "react";

const History = () => (
  <ErrorBoundary>
    <Layout>
      <div className="flex flex-col space-y-8">
        <div className="flex flex-col w-full bg-origin-bg-lgrey rounded-xl">
          History
        </div>
      </div>
    </Layout>
  </ErrorBoundary>
);

export default History;
