import Languages from '../constants/Languages'

const docsURL = process.env.DOCS_URL
const exceptionLanguage = ['IT']

export const getDocsLink = (locale = 'en_US') => {
  const languagesData = Languages.find((l) => l[0] === locale) || Languages[0]
  const docLocal = exceptionLanguage.includes(languagesData[2])
    ? Languages[0][2]
    : languagesData[2]
  return `${docsURL}/v/${docLocal.toLowerCase()}/`
}
