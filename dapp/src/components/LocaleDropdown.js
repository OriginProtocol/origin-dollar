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
  theme,
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

  return (
    <>
      <div className={classnames('dropdown-marble selected', { open }, dropup || 'dropdown', theme )}>
        <Dropdown
          content={
            <div className="dropdown-menu show">
              <LanguageOptions locale={locale} onLocale={onLocale} setOpen={setOpen} />
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
            children={
              <LanguageSelected locale={locale} open={open} theme={theme} />
            }
          />
        </Dropdown>    
      </div>
      <style jsx>{`
        .dropdown-menu {
          right: 0;
          left: auto;
          top: 135%;
          border-radius: 10px;
          box-shadow: 0 0 34px 0 #cdd7e0;
          border: solid 1px #cdd7e0;
          background-color: #ffffff;
          padding: 20px 30px 20px 20px;
          min-width: 170px;
        }
        .dark .dropdown-menu {

        }
      `}</style>
    </>
  )
}

export default LocaleDropdown
