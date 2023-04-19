import React, { useCallback } from "react";
import classNames from "classnames";

interface Props extends React.HTMLProps<HTMLButtonElement> {
  children?: string | React.ReactNode;
  prepend?: React.ReactNode;
  append?: React.ReactNode;
  buttonSize?:
    | "base"
    | "xxs"
    | "xs"
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "3xl"
    | "4xl"
    | "5xl"
    | "6xl";
  palette?:
    | "default"
    | "highlight"
    | "orange"
    | "dimmed"
    | "white"
    | "red"
    | "primary"
    | "error"
    | "blue"
    | "success"
    | "balance"
    | "outline"
    | "deposit";
  className?: string;
  type?: "button" | "submit" | "reset";
  backgroundColor?: string;
}

type PaletteState = {
  backgroundColor?: string;
  borderColor?: string;
  color?: string;
};

type Palette = {
  blur: PaletteState;
  hover: PaletteState;
  disabled: PaletteState;
};

type Palettes = {
  [key: string]: Palette;
};

const Palettes: Palettes = {
  default: {
    blur: {
      backgroundColor: "bg-gradient2",
      borderColor: "border-none",
      color: "text-origin-white",
    },
    hover: {
      backgroundColor: "hover:bg-dark",
      borderColor: "hover:border-dark",
      color: "hover:text-[#FCFCFC]",
    },
    disabled: {
      backgroundColor: "disabled:!bg-dark",
      borderColor: "disabled:!border-dark",
      color: "disabled:!text-[#FCFCFC]",
    },
  },
};

const Button: React.ForwardRefRenderFunction<HTMLButtonElement, Props> = (
  {
    children,
    prepend,
    append,
    className,
    buttonSize = "base",
    palette = "default",
    backgroundColor,
    type = "button",
    href,
    ...restOfProps
  },
  ref
) => {
  const getButtonSize = useCallback((buttonSize) => {
    const classList = [];
    switch (buttonSize) {
      case "sm":
        classList.push("h-[40px] px-6 text-sm");
        break;
      case "lg":
        classList.push("h-[64px] px-12 text-lg");
        break;
      default:
        classList.push("h-[56px] px-10 text-base font-light");
    }
    return classList.join(" ");
  }, []);

  const getClassName = useCallback((palette = "default") => {
    const classList = [];
    // Handle palette
    switch (palette) {
      default:
        classList.push(
          Palettes[palette]?.blur?.backgroundColor,
          Palettes[palette]?.blur?.borderColor,
          Palettes[palette]?.blur?.color,
          Palettes[palette]?.hover?.backgroundColor,
          Palettes[palette]?.hover?.borderColor,
          Palettes[palette]?.hover?.color,
          Palettes[palette]?.disabled?.backgroundColor,
          Palettes[palette]?.disabled?.borderColor,
          Palettes[palette]?.disabled?.color
        );
    }
    return classList.join(" ");
  }, []);

  return (
    <button
      ref={ref}
      className={classNames(
        "flex flex-row items-center rounded-full",
        className,
        getButtonSize(buttonSize),
        getClassName(palette),
        `text-${buttonSize}`
      )}
      {...restOfProps}
      type={type}
    >
      {prepend && (
        <div className="mr-4 flex flex-row items-center">{prepend}</div>
      )}
      {children}
      {append && (
        <div className="ml-4 flex flex-row items-center">{append}</div>
      )}
    </button>
  );
};

export default React.forwardRef(Button);
