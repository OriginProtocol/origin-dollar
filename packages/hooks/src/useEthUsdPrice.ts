import { useNetwork } from 'wagmi';
import { useEffect, useState } from 'react';
import { BigNumber, ethers } from 'ethers';
import { contracts } from '@originprotocol/web3';
import { formatUnits } from '@originprotocol/utils';

const providerRpcUrl = process.env['NEXT_PUBLIC_ETHEREUM_RPC_PROVIDER'] || '';

const CRYPTO_API_URI =
  'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD';

const useEthUsdPrice = () => {
  const { chain } = useNetwork();
  const [ethPrice, setEthPrice] = useState(BigNumber.from(0));

  const fetchEthPriceChainlink = async () => {
    try {
      const provider = new ethers.providers.JsonRpcProvider(providerRpcUrl);
      const { address: chainlinkAddress, abi: chainlinkABI } =
        contracts['mainnet']['chainlinkETH_USD'];
      const chainlinkContract = new ethers.Contract(
        chainlinkAddress,
        chainlinkABI,
        provider
      );
      const priceFeed = await chainlinkContract['latestRoundData']();
      const ethPrice = Math.floor(parseFloat(formatUnits(priceFeed.answer, 8)));
      setEthPrice(BigNumber.from(ethPrice));
    } catch (e) {
      console.error(
        'ERROR: Fetching USD price from chainlink ETH_USD contract',
        e
      );
    }
    return BigNumber.from(0);
  };

  const fetchEthPriceCryptoApi = async () => {
    try {
      const ethPriceResult = await fetch(CRYPTO_API_URI).then((res) =>
        res.json()
      );
      const ethPrice = Math.floor(ethPriceResult?.USD);
      setEthPrice(BigNumber.from(ethPrice));
    } catch (e) {
      console.error('ERROR: Fetching USD price from crypto api', e);
    }
    return BigNumber.from(0);
  };

  const fetchEthPrice = async () => {
    if (chain?.id === 1) {
      await fetchEthPriceChainlink();
    } else {
      await fetchEthPriceCryptoApi();
    }
  };

  useEffect(() => {
    fetchEthPrice();
  }, []);

  return [
    { data: ethPrice, formatted: parseFloat(ethPrice?.toString()) },
    { onRefresh: fetchEthPrice },
  ];
};

export default useEthUsdPrice;
