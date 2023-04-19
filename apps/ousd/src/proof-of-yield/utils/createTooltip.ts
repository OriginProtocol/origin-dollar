import { TooltipModel } from "chart.js";
import { priceGradientEnd, priceGradientStart } from "../../constants";
import { tailwindConfig } from "../../utils";
const colors = tailwindConfig.theme.colors;

// Should probably just be abstracted for tooltip creation. Instead using a
// graphId, just parameterize the whole id.
const createTooltip = (graphId: number) => {
  return (context) => {
    const chart = document.getElementById("dripper-chart" + graphId);
    // Tooltip Element
    let tooltipEl = document.getElementById("dripper-tooltip" + graphId);

    // Create element on first render
    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.id = "dripper-tooltip" + graphId;
      tooltipEl.innerHTML = "<table></table>";
      chart?.appendChild(tooltipEl);
    }

    // Hide if no tooltip
    const tooltipModel: TooltipModel<"bar"> = context.tooltip;
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
  };
};

export default createTooltip;
