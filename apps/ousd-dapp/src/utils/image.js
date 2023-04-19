export function assetRootPath(src) {
  return `${
    src.startsWith('/') && process.env.DEPLOY_MODE === 'ipfs' ? '.' : ''
  }${src}`
}
