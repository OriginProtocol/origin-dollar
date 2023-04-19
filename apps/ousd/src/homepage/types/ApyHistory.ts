interface ApyData {
  day: string; // timestamp
  trailing_apy: string;
}

interface Apy {
  apy7: ApyData[];
  apy30: ApyData[];
  apy365: ApyData[];
}

export default Apy;
