import { enUS } from "date-fns/locale";
import { format } from "date-fns";
import { ChartOptions, TooltipModel } from "chart.js";
import { stakingGradientEnd, stakingGradientStart } from "../constants";
import { smSize } from "../../constants";
import { tailwindConfig } from "../../utils";
const { colors } = tailwindConfig.theme;

const stakeLineOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  parsing: {
    xAxisKey: "time",
    yAxisKey: "amount",
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: false,
      callbacks: {
        //   title: (context) => [
        //     format(context[0].parsed.x, "MM/dd/yyyy"),
        //     format(context[0].parsed.x, "HH:mm"),
        //   ],
        label: (context) => context.formattedValue,
      },
      external: (context) => {
        const chart = document.getElementById("ogv-staking-chart");
        // Tooltip Element
        let tooltipEl = document.getElementById("ogv-staking-tooltip");

        // Create element on first render
        if (!tooltipEl) {
          tooltipEl = document.createElement("div");
          tooltipEl.id = "ogv-staking-tooltip";
          tooltipEl.innerHTML = "<table></table>";
          chart?.appendChild(tooltipEl);
        }

        // Hide if no tooltip
        const tooltipModel: TooltipModel<"line"> = context.tooltip;
        if (tooltipModel.opacity === 0) {
          tooltipEl.style.opacity = "0";
          return;
        }

        // Set caret Position
        tooltipEl.classList.remove("above", "below", "no-transform");
        if (tooltipModel.yAlign) {
          tooltipEl.classList.add(tooltipModel.yAlign);
        } else {
          tooltipEl.classList.add("no-transform");
        }

        function getBody(bodyItem) {
          return bodyItem.lines;
        }

        // Set Text
        if (tooltipModel.body) {
          const bodyLines = tooltipModel.body.map(getBody);

          const stakedPercentage =
            //@ts-ignore
            tooltipModel.$context.tooltip.dataPoints[0].raw.percentage;

          let innerHtml = `<div style="background-image: -webkit-linear-gradient(left, ${stakingGradientStart} -28.99%, ${stakingGradientEnd} 144.97%); color: gray; padding: 2px; border-radius: 0.5rem; min-width: 8rem; width: fit-content">`;

          innerHtml += `<div style="width: full; background: ${colors["origin-bg-black"]}; border-radius: 0.5rem 0.5rem 0 0; padding: .5rem .5rem 0 .5rem;" class="flex justify-between"> `;

          innerHtml +=
            '<div style="font-family: Sailec; font-style: normal; color: white; padding-top: 0.5rem; font-weight: 600; line-height: 1rem">' +
            stakedPercentage +
            "%" +
            "</div>";
          innerHtml += "</div>";

          bodyLines.forEach((body) => {
            innerHtml +=
              `<div style="background: ${colors["origin-bg-black"]}; text-color: ${colors["body-grey"]}; border-radius: 0 0 0.5rem 0.5rem; padding: .5rem; font-size: 0.75rem; font-weight: 400;">` +
              body +
              " OGV" +
              "</div>";
          });

          innerHtml += "</div>";
          tooltipEl.innerHTML = innerHtml;
        }

        const position = context.chart.canvas.getBoundingClientRect();
        const width = tooltipModel.chart.width;

        // Display, position, and set styles for font
        tooltipEl.style.opacity = "1";
        tooltipEl.style.position = "absolute";
        if (tooltipModel.caretX <= width / 2)
          tooltipEl.style.left = tooltipModel.caretX + "px";
        else {
          tooltipEl.style.left = "auto";
          tooltipEl.style.right = width - tooltipModel.caretX + "px";
        }
        tooltipEl.style.top = tooltipModel.caretY + "px";

        tooltipEl.style.marginLeft = "0.5rem";
        tooltipEl.style.marginRight = "0.5rem";
        tooltipEl.style.pointerEvents = "none";
      },
    },
  },
  interaction: {
    mode: "index",
    intersect: false,
  },
  hover: {
    mode: "index",
    intersect: false,
  },
  borderColor: colors["white"],
  scales: {
    x: {
      type: "time",
      border: {
        color: colors["body-grey"],
      },
      time: {
        displayFormats: {
          hour: "dd MMM yy",
          day: "dd MMM yy",
          month: "dd MMM yy",
        },
      },
      adapters: {
        date: {
          locale: enUS,
        },
      },
      ticks: {
        autoSkip: true,
        maxTicksLimit: 5,
        align: "start",
        maxRotation: 0,
        padding: 8,
        color: colors["subheading"],
        font: () => {
          if (window.innerWidth < smSize)
            return {
              size: 12,
            };
          return {
            size: 16,
          };
        },
      },
      grid: {
        display: false,
      },
    },
    y: {
      border: {
        display: false,
      },
      position: "right",
      ticks: {
        padding: 10,
        color: colors["subheading"],
        font: () => {
          if (window.innerWidth < smSize)
            return {
              size: 12,
            };
          return {
            size: 18,
          };
        },
        callback: (value: number) => {
          if (value >= 1000000000) {
            return (value / 1000000000).toPrecision(3) + "B";
          } else if (value >= 1000000) {
            return (value / 1000000).toPrecision(3) + "M";
          } else if (value >= 1000) {
            return (value / 1000).toPrecision(3) + "K";
          } else {
            return value;
          }
        },
      },
      grid: {
        display: false,
      },
    },
    // Hacky but the second (invisible) y-axis allows for adding padding to the left xD
    y1: {
      title: {
        display: true,
        text: "Amount Staked",
        align: "center",
        font: {
          size: 16,
        },
        color: colors["subheading"],
        padding: {
          top: 12,
        },
      },
      type: "time",
      display: true,
      position: "left",
      border: {
        display: false,
      },
      ticks: {
        maxTicksLimit: 1,
        autoSkip: true,
        callback: () => "", // The padding
      },
    },
    x1: {
      type: "time",
      display: true,
      position: "top",
      border: {
        display: false,
      },
      ticks: {
        maxTicksLimit: 1,
        autoSkip: true,
        callback: () => "  ", // The padding
      },
    },
  },
};

export default stakeLineOptions;
