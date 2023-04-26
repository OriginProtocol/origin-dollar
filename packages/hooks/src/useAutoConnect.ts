import { useEffect } from 'react';
import { useConnect } from 'wagmi';

function useAutoConnect() {
  const { connect, connectors } = useConnect();
  useEffect(() => {
    const connectorInstance = connectors.find((c) => c.id === 'safe');
    if (connectorInstance?.ready) {
      connect({ connector: connectorInstance });
    }
  }, [connect, connectors]);
}

export default useAutoConnect;
