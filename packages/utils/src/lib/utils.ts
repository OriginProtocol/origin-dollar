export const shortAddress = (address: string, offset = 4): string =>
  address
    ? address.substring(0, 6 + offset) +
      '...' +
      address.substring(address.length - (4 + offset))
    : '';
