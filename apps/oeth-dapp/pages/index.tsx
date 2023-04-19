import { ErrorBoundary, Layout } from '../src/components';
import React from 'react';
import { utils } from '@originprotocol/utils';

const Swap = () => {
  console.log(utils());
  return (
    <ErrorBoundary>
      <Layout>
        <div className="flex flex-col space-y-8">
          <div className="flex flex-col w-full bg-origin-bg-lgrey rounded-xl">
            Swap
          </div>
          <div className="flex flex-col w-full bg-origin-bg-lgrey rounded-xl">
            Swap Routes
          </div>
        </div>
      </Layout>
    </ErrorBoundary>
  );
};

export default Swap;
