import cx from "classnames";
import { TailSpin } from "react-loader-spinner";

const LayoutBox = ({
  className = "",
  loadingClassName = "",
  isLoading = false,
  children,
}) => (
  <div
    className={cx(
      "relative flex flex-col w-full h-full bg-origin-bg-grey rounded-md",
      className
    )}
  >
    {isLoading && (
      <div
        className={cx(
          "flex items-center justify-center rounded-md absolute z-[2] left-0 top-0 w-full h-full bg-black bg-opacity-20",
          loadingClassName
        )}
      >
        <TailSpin
          height="100"
          width="100"
          color="#0074F0"
          ariaLabel="tail-spin-loading"
          radius="1"
          visible={true}
        />
      </div>
    )}
    {children}
  </div>
);

export default LayoutBox;
