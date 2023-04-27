import { ReactNode } from 'react';
import { QueryClientProvider, QueryClient } from 'react-query';
import ErrorBoundary from '../core/ErrorBoundary';
import Wagmi from '../core/Wagmi';

const defaultQueryFn = (url: string) => fetch(url).then((res) => res.json());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // @ts-ignore
      queryFn: defaultQueryFn,
    },
  },
});

const DappContainer = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <Wagmi>{children}</Wagmi>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default DappContainer;
