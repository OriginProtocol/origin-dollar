import * as Sentry from '@sentry/node'
import { RewriteFrames } from '@sentry/integrations'
import getConfig from 'next/config'

const isStaging = process.env.STAGING === 'true'
const isProduction = process.env.NODE_ENV === 'production'

export const initSentry = () => {
  if (!process.env.SENTRY_DSN) {
    return
  }

  const config = getConfig()
  const distDir = `${config.serverRuntimeConfig.rootDir}/.next`
  Sentry.init({
    enabled: isProduction || isStaging,
    environment: isProduction ? 'production' : 'staging',
    integrations: [
      new RewriteFrames({
        iteratee: (frame) => {
          frame.filename = frame.filename.replace(distDir, 'app:///_next')
          return frame
        },
      }),
    ],
    dsn: process.env.SENTRY_DSN,
  })
}
