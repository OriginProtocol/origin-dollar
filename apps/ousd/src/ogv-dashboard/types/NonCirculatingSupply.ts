interface NonCirculatingSupplyItem {
  address: string;
  internalLabel: string;
  publicLabel: string;
  balance?: string;
}

type NonCirculatingSupply = NonCirculatingSupplyItem[];

export default NonCirculatingSupply;
