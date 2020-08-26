import classnames from 'classnames'

import Languages from '../constants/Languages'

const LanguagesByKey = Languages.reduce((m, o) => {
  m[o[0]] = o[2]
  return m
}, {})

const LanguageSelected = ({ locale, open, theme }) => {
  return (
    <>
      <div className={classnames('language-selected', { open }, theme)}>
        {LanguagesByKey[locale]}
      </div>
      <style jsx>{`
        .language-selected {
          color: #8293a4;
          font-size: 0.875rem;
        }
        .dark.language-selected {
          color: white;
        }

        .language-selected.open {
          color: #fafbfc;
        }
        .dark.language-selected.open {
        }

        @media (max-width: 992px) {
          .language-selected {
            font-size: 0.6875rem;
          }
        }
      `}</style>
    </>
  )
}

export default LanguageSelected
