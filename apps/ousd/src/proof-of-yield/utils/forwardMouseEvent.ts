import { ChartEvent } from "chart.js";

const forwardMouseEvent = (
  canvas: HTMLCanvasElement,
  event: Event | ChartEvent
) => {
  if (
    !(
      (event instanceof Event && event.isTrusted) ||
      (event as ChartEvent).native?.isTrusted
    )
  )
    return;

  const rect = canvas.getBoundingClientRect();
  const mouseEvent = new MouseEvent(event.type, {
    clientX: "x" in event ? event.x + rect.x : undefined,
    clientY: "y" in event ? event.y + rect.y : undefined,
  });

  canvas.dispatchEvent(mouseEvent);
};

export default forwardMouseEvent;
