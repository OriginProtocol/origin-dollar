import React, { useState } from 'react'

import Languages from '../constants/Languages'
import Dropdown from 'components/Dropdown'

const LanguagesByKey = Languages.reduce((m, o) => {
  m[o[0]] = o[2]
  return m
}, {})

const LocaleDropdown = ({
  className,
  locale,
  dropup,
  onLocale,
  useNativeSelectbox
}) => {
  const [open, setOpen] = useState(false)

  if (useNativeSelectbox) {
    return (
      <select
        className={className}
        value={locale}
        onChange={e => onLocale(e.target.value)}
      >
        {Languages.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    )
  }

  const selected = (
    <div className="dropdown-selected">
      {LanguagesByKey[locale]}
      <span className="arrow" />
    </div>
  )
  return (
    <Dropdown
      className={`dropdown-marble active ${dropup ? 'dropup' : 'dropdown'}`}
      content={
        <div className="dropdown-menu show">
          {Languages.map(lang => (
            <a
              key={lang[0]}
              title={lang[0]}
              href="#"
              onClick={e => {
                e.preventDefault()
                onLocale(lang[0])
                setOpen(false)
              }}
            >
              <div className={`d-flex${lang[0] == locale ? ' active' : ''}`}>
                <div className={`dropdown-marble dropdown-item`}>
                  {lang[2]}
                </div>
                {lang[1]}
              </div>
            </a>
          ))}
        </div>
      }
      open={open}
      onClose={() => setOpen(false)}
    >
      <a
        href="#"
        className={className}
        onClick={e => {
          e.preventDefault()
          setOpen(!open)
        }}
        children={selected}
      />
    </Dropdown>
  )
}

export default LocaleDropdown
