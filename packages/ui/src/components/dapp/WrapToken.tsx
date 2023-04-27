import React, { useState } from 'react';
import ExternalCTA from '../core/ExternalCTA';

type WrapTokenProps = {
  i18n: any;
  assets: any;
  emptyState: any;
};

const WrapToken = ({ i18n, assets, emptyState }: WrapTokenProps) => {
  const [showingEmptyState] = useState(true);
  return (
    <div className="flex flex-col space-y-8">
      {showingEmptyState && emptyState && <ExternalCTA {...emptyState} />}
    </div>
  );
};

export default WrapToken;
