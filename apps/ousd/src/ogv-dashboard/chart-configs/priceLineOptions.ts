import { enUS } from "date-fns/locale";
import { format } from "date-fns";
import { ChartOptions, TooltipModel } from "chart.js";
import { smSize } from "../../constants";
import { priceGradientStart, priceGradientEnd } from "../../constants";
import { tailwindConfig } from "../../utils";
import { utils } from "ethers";
const { colors } = tailwindConfig.theme;
const { commify } = utils;

const priceLineOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: false,
      callbacks: {
        title: (context) => [
          format(context[0].parsed.x, "MM/dd/yyyy"),
          format(context[0].parsed.x, "HH:mm"),
        ],
        label: (context) => {
          return context.dataset.label === "Price"
            ? "$" + (context.raw as number).toPrecision(4)
            : context.formattedValue;
        },
      },
      external: (context) => {
        const chart = document.getElementById("ogv-price-chart");
        // Tooltip Element
        let tooltipEl = document.getElementById("ogv-price-tooltip");

        // Create element on first render
        if (!tooltipEl) {
          tooltipEl = document.createElement("div");
          tooltipEl.id = "ogv-price-tooltip";
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
          const titleLines = tooltipModel.title || [];
          const bodyLines = tooltipModel.body.map(getBody);

          let innerHtml = `<div style="background-image: -webkit-linear-gradient(left, ${priceGradientStart} -28.99%, ${priceGradientEnd} 144.97%); color: gray; padding: 2px; border-radius: 0.5rem; min-width: 8rem; width: fit-content">`;

          innerHtml += `<div style="width: full; background: ${colors["origin-bg-black"]}; border-radius: 0.5rem 0.5rem 0 0; padding: .5rem .5rem 0 .5rem;" class="flex justify-between"> `;

          titleLines.forEach((title) => {
            innerHtml +=
              '<div style="font-family: Sailec; font-style: normal; font-weight: 400; font-size: 0.75rem; line-height: 1rem">' +
              title +
              "</div>";
          });
          innerHtml += "</div>";

          bodyLines.forEach((body) => {
            if (body[0].charAt(0) !== "$") body[0] = "$" + body[0];
            innerHtml +=
              `<div style="background: ${colors["origin-bg-black"]}; border-radius: 0 0 0.5rem 0.5rem; padding: .5rem; color: white; font-weight: 600;">` +
              body +
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
          hour: "HH:mm",
          day: "HH:mm",
          month: "MM/yy",
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
        count: 4,
        callback: function (val) {
          if (typeof val === "string") val = parseFloat(val);
          return "$" + commify(parseFloat(val.toPrecision(3)));
        },
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
      },
      grid: {
        display: false,
      },
    },
    // Hacky but the second (invisible) y-axis allows for adding padding to the left xD
    y1: {
      type: "time",
      display: true,
      position: "left",
      border: {
        display: false,
      },
      ticks: {
        maxTicksLimit: 1,
        autoSkip: true,
        callback: () => "  ", // The padding
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

export default priceLineOptions;
