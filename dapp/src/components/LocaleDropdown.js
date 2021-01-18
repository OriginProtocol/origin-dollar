import React, { useState } from 'react'
import classnames from 'classnames'

import Languages from '../constants/Languages'
import Dropdown from 'components/Dropdown'
import LanguageSelected from 'components/LanguageSelected'
import LanguageOptions from 'components/LanguageOptions'

const LocaleDropdown = ({
  className,
  outerClassName,
  locale,
  dropup,
  onLocale,
  useNativeSelectbox,
  footer,
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
    <>
      <Dropdown
        className="d-flex align-items-center"
        content={
          <div className={`dropdown-menu show ${footer ? 'dropup' : ''}`}>
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
        <div
          className={classnames(
            'dropdown-marble selected',
            { open, outerClassName, footer },
            dropup || 'dropdown'
          )}
          onClick={(e) => {
            e.preventDefault()
            setOpen(!open)
          }}
        >
          <a
            href="#"
            className={className}
            children={
              <LanguageSelected locale={locale} dark={footer} open={open} />
            }
          />
        </div>
      </Dropdown>
      <style jsx>{`
        .dropdown-marble.footer {
          border-color: #8293a4;
        }

        .dropdown-marble.footer:hover {
          border-color: #18313f;
          background-color: transparent;
        }

        .dropdown-marble.footer.open {
          background-color: #8293a4;
        }

        .dropdown-marble.footer.open:hover {
          background-color: #18313f;
        }

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default LocaleDropdown
