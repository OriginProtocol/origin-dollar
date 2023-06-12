export const isDevelopment = process.env.NODE_ENV === 'development'
export const isProduction = process.env.NODE_ENV === 'production'

export const useAlchemyForBalances =
  process.env.USE_ALCHEMY_FOR_BALANCES === 'true'
