import { BigNumber } from "ethers";
import { NonCirculatingSupply } from "../types";

const calculateCirculatingSupply = (
  totalSupply: string | number | BigNumber,
  nonCirculatingSupply: NonCirculatingSupply
) => {
  const total = BigNumber.from(totalSupply);
  const nonCirculatingBalances = nonCirculatingSupply.map((e) =>
    BigNumber.from(e.balance)
  );
  const nonCirculatingTotal = nonCirculatingBalances.reduce(
    (a, b) => a.add(b),
    BigNumber.from("0")
  );
  return total.sub(nonCirculatingTotal);
};

export default calculateCirculatingSupply;
