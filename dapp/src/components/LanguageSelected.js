import classnames from 'classnames'

import Languages from '../constants/Languages'

const LanguagesByKey = Languages.reduce((m, o) => {
  m[o[0]] = o[2]
  return m
}, {})

const LanguageSelected = ({ locale, open, dark }) => {
  return (
    <>
      <div className={classnames('language-selected', { open, dark })}>
        {LanguagesByKey[locale]}
      </div>
      <style jsx>{`
        .language-selected {
          color: white;
          font-size: 0.81rem;
        }

        .language-selected.dark {
          color: #8293a4;
        }

        .language-selected.dark:hover {
          color: #18313f;
        }

        .language-selected.open {
          color: #fafbfc;
        }

        .language-selected.open.dark {
          color: #fafbfc !important;
        }

        .language-selected.open.dark:hover {
          color: white;
        }

        @media (max-width: 799px) {
          .language-selected {
            font-size: 0.6875rem;
          }
        }
      `}</style>
    </>
  )
}

export default LanguageSelected
