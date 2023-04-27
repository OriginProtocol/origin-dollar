import React, { useState } from 'react';
import ExternalCTA from '../core/ExternalCTA';

const WrapToken = ({ i18n, assets, emptyState }) => {
  const [showingEmptyState, setShowingEmptyState] = useState(true);
  return (
    <div className="flex flex-col space-y-8">
      {showingEmptyState && emptyState && <ExternalCTA {...emptyState} />}
    </div>
  );
};

export default WrapToken;
