import React, { useState } from 'react'
import classnames from 'classnames'

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
            children={
              <div className={`dropdown-selected ${open ? 'open' : ''}`}>
                {LanguagesByKey[locale]}
                <span className="arrow" />
              </div>
            }
          />
        </Dropdown>    
      </div>
      <style jsx>{`
        .dropdown-marble {
          border-radius: 15px;
          border: solid 1px #cdd7e0;
          background-color: #1a82ff;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 30px;
          height: 30px;
          padding: 0;
          color: white;
        }
        .light.dropdown-marble {
          border-color: white;
        }

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
        .dropdown-marble.active {
          background-color: #1e313f;
        }
        .light .dropdown-menu {

        }
        .light .dropdown-marble.active {

        }

        .dropdown-marble.selected {
          background-color: transparent;
        }

        .dropdown-marble.selected.open {
          background-color: #1e313f;
        }
        .light.dropdown-marble.selected.open {

        }

        a .dropdown-selected {
          color: #8293a4;
          font-size: 14px;
        }
        .light a .dropdown-selected {
          color: white;
        }

        a .dropdown-selected.open {
          color: #fafbfc;
        }
        .light a .dropdown-selected.open {

        }

        .dropdown-menu .dropdown-marble {
          margin-right: 18px;
        }
        .dropdown-menu a:not(:last-child) > div {
          margin-bottom: 10px;  
        }

        .dropdown-menu a {
          color: #1e313f;
        }
        .light .dropdown-menu a {

        }

        .dropdown-menu a .active {
          font-weight: bold;
        }

        .dropdown-menu a .active .dropdown-marble {
          background-color: #1e313f;
        }
        .light .dropdown-menu a .active .dropdown-marble {

        }
      `}</style>
    </>
  )
}

export default LocaleDropdown
