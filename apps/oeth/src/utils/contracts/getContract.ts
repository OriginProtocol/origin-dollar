import { Contract, ContractInterface, Signer } from 'ethers';
import { Provider } from '@ethersproject/providers';

export const getContract = <T extends Contract>(
  address: string,
  contractInterface: ContractInterface,
  provider: Provider | Signer
) => {
  try {
    return new Contract(address, contractInterface, provider) as T;
  } catch (e) {
    console.error(
      `Error creating contract in [getContract] with address:${address}
      )}`
    );
    throw e;
  }
};

export default getContract;
