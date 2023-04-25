import { ErrorBoundary, Layout } from '../src/components';
import React from 'react';

const Wrap = () => (
  <ErrorBoundary>
    <Layout>
      <div className="flex flex-col space-y-8">
        <div className="flex flex-col w-full bg-origin-bg-lgrey rounded-xl">
          Wrap
        </div>
      </div>
    </Layout>
  </ErrorBoundary>
);

export default Wrap;
