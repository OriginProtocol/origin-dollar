interface Block {
  number: string;
  hash: string;
  transactions: [];
  difficulty: string;
  extraData: string;
  gasLimit: string;
  gasUsed: string;
  logsBloom: string;
  miner: string;
  mixHash: string;
  nonce: string;
  parentHash: string;
  receiptsRoot: string;
  sha3Uncles: string;
  size: string;
  stateRoot: string;
  timestamp: string;
  totalDifficulty: string;
  transactionsRoot: string;
  uncles: [];
  baseFeePerGas: string;
}

interface GetBlockByNumberResponse {
  jsonrpc: string;
  id: number;
  result: Block;
}

export default GetBlockByNumberResponse;
