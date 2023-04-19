import getContract from './getContract';
import { providers } from 'ethers';
import { addresses } from '../../../constants';
import {
  Ousd,
  Vault,
  Dripper,
  Ogv,
  Veogv,
  Ousd__factory,
  Vault__factory,
  Dripper__factory,
  Ogv__factory,
  Veogv__factory,
} from '../../../types/contracts';

export const setupContracts = () => {
  const provider = new providers.StaticJsonRpcProvider(
    process.env.NEXT_PUBLIC_ETHEREUM_RPC_PROVIDER,
    {
      chainId: parseInt(
        process.env.NEXT_PUBLIC_ETHEREUM_RPC_CHAIN_ID || '1',
        10
      ),
      name: 'mainnet',
    }
  );

  const ousd = getContract<Ousd>(
    addresses.mainnet.OUSDProxy,
    Ousd__factory.createInterface(),
    provider
  );
  const vault = getContract<Vault>(
    addresses.mainnet.Vault,
    Vault__factory.createInterface(),
    provider
  );
  const dripper = getContract<Dripper>(
    addresses.mainnet.Dripper,
    Dripper__factory.createInterface(),
    provider
  );
  const ogv = getContract<Ogv>(
    addresses.mainnet.OGV,
    Ogv__factory.createInterface(),
    provider
  );
  const veogv = getContract<Veogv>(
    addresses.mainnet.veOGV,
    Veogv__factory.createInterface(),
    provider
  );

  const contractsToExport = {
    ousd,
    vault,
    dripper,
    ogv,
    veogv,
  };

  return contractsToExport;
};

export default setupContracts;
