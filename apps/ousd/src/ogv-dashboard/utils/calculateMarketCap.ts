import { BigNumber } from "ethers";
import { formatEther } from "ethers/lib/utils";

const calculateMarketCap = (
  circulatingSupply: BigNumber,
  price: number
): number => {
  return parseFloat(formatEther(circulatingSupply)) * price;
};

export default calculateMarketCap;
