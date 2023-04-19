import { commify } from "ethers/lib/utils";

const commifyToDecimalPlaces = (num: number, decimalPlaces: number) =>
  commify(num.toFixed(0)) + "." + num.toFixed(decimalPlaces).split(".")[1];

export default commifyToDecimalPlaces;
