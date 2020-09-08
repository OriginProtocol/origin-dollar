import React, { useState } from 'react'

import classnames from 'classnames'
import Languages from '../constants/Languages'

const TimelockedButton = ({
  disabled = false,
  className = '',
  onClick,
  text,
  disabledAfterClick = 5735,
}) => {
  const [timeDisabled, setTimeDisabled] = useState(false)

  const disableAfterClick = () => {
    setTimeDisabled(true)

    setTimeout(() => {
      setTimeDisabled(false)
    }, disabledAfterClick)
  }

  return (
    <>
      <button
        disabled={disabled || timeDisabled}
        className={className}
        onClick={(e) => {
          disableAfterClick()
          onClick(e)
        }}
      >
        {text}
      </button>
      <style jsx>{``}</style>
    </>
  )
}

export default TimelockedButton
