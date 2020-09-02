import React, { useState } from 'react'
import classnames from 'classnames'

import Languages from '../constants/Languages'
import Dropdown from 'components/Dropdown'
import LanguageSelected from 'components/LanguageSelected'
import LanguageOptions from 'components/LanguageOptions'

const LocaleDropdown = ({
  className,
  locale,
  dropup,
  onLocale,
  useNativeSelectbox,
}) => {
  const [open, setOpen] = useState(false)

  if (useNativeSelectbox) {
    return (
      <select
        className={className}
        value={locale}
        onChange={(e) => onLocale(e.target.value)}
      >
        {Languages.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div
      className={classnames(
        'dropdown-marble selected',
        { open },
        dropup || 'dropdown'
      )}
    >
      <Dropdown
        content={
          <div className="dropdown-menu show">
            <LanguageOptions
              locale={locale}
              onLocale={onLocale}
              setOpen={setOpen}
            />
          </div>
        }
        open={open}
        onClose={() => setOpen(false)}
      >
        <a
          href="#"
          className={className}
          onClick={(e) => {
            e.preventDefault()
            setOpen(!open)
          }}
          children={<LanguageSelected locale={locale} open={open} />}
        />
      </Dropdown>
    </div>
  )
}

export default LocaleDropdown
