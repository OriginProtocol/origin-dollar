import { QueryClientProvider, QueryClient } from 'react-query';
import ErrorBoundary from '../core/ErrorBoundary';
import Wagmi from '../core/Wagmi';

const defaultQueryFn = async (url) => fetch(url).then((res) => res.json());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
    },
  },
});

const DappContainer = ({ children }) => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <Wagmi>{children}</Wagmi>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default DappContainer;
