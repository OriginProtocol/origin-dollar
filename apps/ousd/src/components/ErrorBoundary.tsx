import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import { Typography } from "@originprotocol/origin-storybook";
import Button from "./Button";

const fallbackRender = ({ resetErrorBoundary }) => {
  return (
    <div
      role="alert"
      className="flex flex-col space-y-4 items-center justify-center text-center h-[50vh]"
    >
      <Typography.H2
        as="h1"
        className="text-2xl md:text-7xl text-gradient2 font-bold"
      >
        Ooops...
      </Typography.H2>
      <Typography.H3
        className="text-xl md:text-2xl"
        style={{ fontWeight: 400 }}
      >
        Sorry, an error occurred while loading the view.
      </Typography.H3>
      <footer>
        <Button buttonSize="sm" onClick={resetErrorBoundary}>
          <Typography.Body2>Please try again</Typography.Body2>
        </Button>
      </footer>
    </div>
  );
};

const logError = (error: Error, info: { componentStack: string }) => {
  // Do something with the error, e.g. log to an external API
  console.error(error);
};

const ErrorBoundary = ({ children }) => (
  <ReactErrorBoundary fallbackRender={fallbackRender} onError={logError}>
    {children}
  </ReactErrorBoundary>
);

export default ErrorBoundary;
