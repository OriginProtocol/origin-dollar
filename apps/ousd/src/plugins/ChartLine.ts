import { Plugin } from "chart.js";

export const ChartLine: Plugin = {
  id: "chart-line", //typescript crashes without id
  beforeDraw: function (chart: any, easing: any) {
    if (
      chart.tooltip?._active &&
      chart.tooltip?._active.length &&
      chart.scales?.x &&
      chart.scales?.y
    ) {
      const activePoint = chart.tooltip._active[0];
      const ctx = chart.ctx;
      const x = activePoint.element.x;
      const topY = chart.scales.y.top;
      const bottomY = chart.scales.y.bottom;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#8493a6";
      ctx.stroke();
      ctx.restore();
    }
  },
};

export default ChartLine;
