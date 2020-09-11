import classnames from 'classnames'

import Languages from '../constants/Languages'

const LanguagesByKey = Languages.reduce((m, o) => {
  m[o[0]] = o[2]
  return m
}, {})

const LanguageSelected = ({ locale, open }) => {
  return (
    <>
      <div className={classnames('language-selected', { open })}>
        {LanguagesByKey[locale]}
      </div>
      <style jsx>{`
        .language-selected {
          color: white;
          font-size: 0.81rem;
        }

        .language-selected.open {
          color: #fafbfc;
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
