const animations = {}

export function animateValue({
  from, // start value
  to, // end value
  callbackValue, // callback that is called each animation frame with the animated "value" property
  onCompleteCallback, // callback that is called each animation frame with the animated "value" property
  duration, // duration in miliseconds
  id, // unique animation id. So new animations issued with this is can ovverride old ones
  roundToFullNumbers = false,
  easing = 'linear', // linear, circin, inBack, outBack
  delay = 0, // delay in miliseconds
  stepTime = 30, // how often should the routine update state in miliseconds
}) {
  const getCurrentTime = () => {
    return new Date().getTime()
  }

  id = id ? id : Math.round(Math.random() * 10000)

  const executeRoutine = () => {
    const start = getCurrentTime()
    callbackValue(from)
    if (animations[id]) {
      clearInterval(animations[id])
    }

    const interval = setInterval(() => {
      const time = getCurrentTime()
      // animation stopped
      if (time - start > duration) {
        callbackValue(to)
        clearInterval(interval)
        delete animations[id]
        if (onCompleteCallback) {
          onCompleteCallback()
        }
        return
      }

      const change = to - from
      const time_elapsed = time - start
      let value
      if (easing === 'linear') {
        const completedPercentage = time_elapsed / parseFloat(duration)
        value = from + change * completedPercentage
      } else if (easing === 'circin') {
        const t = time_elapsed / duration
        value = -change * (Math.sqrt(1 - t * t) - 1) + from
      } else if (easing === 'inBack') {
        const s = 1.70158
        const completedPercentage = time_elapsed / duration
        const n =
          completedPercentage *
          completedPercentage *
          ((s + 1) * completedPercentage - s)
        value = from + change * n
      } else if (easing === 'outBack') {
        const s = 1.70158
        let completedPercentage = time_elapsed / duration
        const n =
          --completedPercentage *
            completedPercentage *
            ((s + 1) * completedPercentage + s) +
          1
        value = from + change * n
      }

      if (roundToFullNumbers) value = Math.round(value)
      callbackValue(value)
    }, stepTime)

    animations[id] = interval
  }

  let startTimeout
  if (delay === 0) {
    executeRoutine()
  } else {
    startTimeout = setTimeout(() => {
      executeRoutine()
    }, delay)
  }

  const cancelRoutine = () => {
    clearInterval(animations[id])
    clearTimeout(startTimeout)
  }

  return cancelRoutine
}
