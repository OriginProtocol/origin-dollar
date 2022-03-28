import React from 'react'

export default function DownCaret({ color = '#608fcf', size = '30' }) {
  return (
    <svg
      style={{ marginRight: -13 }}
      width={size}
      height={size}
      viewBox="0 0 20 20"
    >
      <g stroke={color} strokeWidth="1" strokeLinecap="round">
        <line x1="7" y1="9" x2="10" y2="12" />
        <line x1="10" y1="12" x2="13" y2="9" />
      </g>
    </svg>
  )
}
