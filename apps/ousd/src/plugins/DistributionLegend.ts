import { Plugin } from "chart.js";
import { BigNumber } from "ethers";
import { smSize } from "../constants";

const getOrCreateLegendList = (chart, id) => {
  const legendContainer = document?.getElementById(id);
  let listContainer = legendContainer?.querySelector("ul");

  if (!listContainer) {
    listContainer = createElement("ul", [], {
      style: {
        display: "flex",
        flexDirection: "column",
        margin: "0",
        padding: "2rem 0 0 0",
      },
    }) as HTMLUListElement;

    legendContainer?.appendChild(listContainer);
  }

  return listContainer;
};

export const distributionLegendPlugin: (id: string) => Plugin = (
  id: string
) => ({
  id,
  afterUpdate(chart, args, options) {
    // @ts-ignore
    if (chart?.config?.type !== "doughnut") return;
    const ul = getOrCreateLegendList(chart, options.containerId);

    while (ul.firstChild) ul.firstChild.remove();

    const { data } = chart.config;

    // Reuse the built-in legendItems generator
    const { labels, datasets } = data;

    (labels as string[]).forEach((item, i) => {
      // Color box
      const boxSpan = createElement("span", [], {
        style: {
          background: datasets[0].backgroundColor[i],
          borderWidth: datasets[0].borderWidth + "px",
          display: "inline-block",
          height: "20px",
          maxHeight: "20px",
          width: "20px",
          minWidth: "20px",
          borderRadius: "100%",
        },
      });

      // Shareholder
      const text = document.createTextNode(item);

      const textContainer = createElement("p", [text], {
        style: {
          display: "inline",
          color: "#FFF",
          margin: "0",
          padding: "0 1.5rem",
        },
      });

      // Percentage
      const dataLabel = datasets[0].label;
      const totalSupply = BigNumber.from(dataLabel);
      // Maintains precesion until 2 decimal places
      const percentage = (
        BigNumber.from(datasets[0].data[i])
          .mul(10000)
          .div(totalSupply)
          .toNumber() / 100
      ).toString();

      const percentageNode = document.createTextNode(percentage + "%");

      const percentContainer = createElement("p", [percentageNode], {
        style: {
          display: "inline",
          color: "#FFF",
          marginLeft: "auto",
          fontWeight: "800",
        },
      });

      const innerWidth = window.innerWidth;
      const paddingBottom = innerWidth >= smSize ? "2rem" : "0.75rem";
      const fontSize = innerWidth >= smSize ? "16px" : "14px";

      const li = createElement(
        "li",
        [boxSpan, textContainer, percentContainer],
        {
          style: {
            display: "flex",
            alignItems: "center",
            width: "100%",
            paddingBottom,
            fontSize,
          },
        }
      );

      function checkMq(x: MediaQueryListEvent) {
        if (x.matches) {
          li.style.paddingBottom = "0.75rem";
          li.style.fontSize = "14px";
        } else {
          li.style.paddingBottom = "2rem";
          li.style.fontSize = "16px";
        }
      }

      ul?.appendChild(li);

      const mediaQuery = window.matchMedia(`(min-width: ${smSize}px)`);
      mediaQuery.addEventListener("change", checkMq);
    });
  },
});

const createElement = (
  tagName: string,
  children: (HTMLElement | Text)[],
  props: { style: Object }
) => {
  const element = document.createElement(tagName);

  const styleKeys = Object.keys(props.style);
  if (styleKeys.length > 0) {
    styleKeys.forEach((key) => {
      element.style[key] = props.style[key];
    });
  }

  if (children.length > 0) {
    children.forEach((child) => {
      element?.appendChild(child);
    });
  }

  return element;
};

export default distributionLegendPlugin;
