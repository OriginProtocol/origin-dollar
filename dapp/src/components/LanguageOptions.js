import classnames from 'classnames'

import Languages from '../constants/Languages'

const LanguageOptions = ({ locale, onLocale, setOpen }) => {
  return (
    <>
      {Languages.map((lang) => (
        <a
          key={lang[0]}
          title={lang[0]}
          href="#"
          onClick={(e) => {
            e.preventDefault()

            typeof onLocale === 'function' && onLocale(lang[0])
            typeof setOpen === 'function' && setOpen(false)
          }}
        >
          <div className={classnames('d-flex', { active: lang[0] == locale })}>
            <div className={`dropdown-marble dropdown-item`}>{lang[2]}</div>
            {lang[1]}
          </div>
        </a>
      ))}
      <style jsx>{`
        @media (max-width: 992px) {
          a {
            color: black;
            text-decoration: none;
          }

          a .active {
            font-size: 1.5rem;
            font-weight: bold;
          }

          a .d-flex {
            align-items: center;
            margin-bottom: 28px;
          }

          .dropdown-marble {
            border-radius: 20px;
            font-size: 1.125rem;
            height: 40px;
            margin-right: 20px;
            width: 40px;
          }

          .active .dropdown-marble {
            background: black;
          }
        }
      `}</style>
    </>
  )
}

export default LanguageOptions
