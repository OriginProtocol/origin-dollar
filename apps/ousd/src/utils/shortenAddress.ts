const shortenAddress = (address: string, charsEachSide: number = 4) =>
  address.substring(0, 2 + charsEachSide) +
  "..." +
  address.substring(address.length - charsEachSide);

export default shortenAddress;
