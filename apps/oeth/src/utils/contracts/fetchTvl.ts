import { ContractStore } from '../../../stores';

export const fetchTvl = async (vault, dripper) => {
  const tvl = await vault?.totalValue().then((r) => Number(r) / 10 ** 18);
  const rewards = await dripper
    ?.availableFunds()
    .then((r) => Number(r) / 10 ** 6);
  ContractStore.update((s) => {
    s.ousdTvl = tvl + rewards;
  });
  return tvl + rewards;
};

export default fetchTvl;
