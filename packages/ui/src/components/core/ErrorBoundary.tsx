import { ReactNode } from 'react';
import {
  ErrorBoundary as ReactErrorBoundary,
  FallbackProps,
} from 'react-error-boundary';

type ErrorBoundaryProps = {
  children: ReactNode;
};

const fallbackRender = ({ resetErrorBoundary }: FallbackProps) => {
  return (
    <div
      role="alert"
      className="flex flex-col space-y-4 items-center justify-center text-center h-[50vh]"
    >
      <h1 className="text-2xl md:text-7xl text-gradient2 font-bold">
        Ooops...
      </h1>
      <h3 className="text-xl md:text-2xl font-normal">
        Sorry, an error occurred while loading the view.
      </h3>
      <footer>
        <button onClick={resetErrorBoundary}>
          <p>Please try again</p>
        </button>
      </footer>
    </div>
  );
};

const logError = (error: Error, info: { componentStack: string }) => {
  // Do something with the error, e.g. log to an external API
  console.error(error);
};

const ErrorBoundary = ({ children }: ErrorBoundaryProps) => (
  <ReactErrorBoundary fallbackRender={fallbackRender} onError={logError}>
    {children}
  </ReactErrorBoundary>
);

export default ErrorBoundary;
