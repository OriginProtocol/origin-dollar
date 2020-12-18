import { ethers } from 'ethers'
import get from 'lodash/get'
import Cors from 'cors'

const chainId = parseInt(process.env.ETHEREUM_RPC_CHAIN_ID)
let network
try {
  network = require(`../../${chainId === 1 ? 'prod.' : ''}network.json`)
} catch (e) {
  console.error('network.json file not present')
}
const jsonRpcProvider = new ethers.providers.JsonRpcProvider(
  process.env.ETHEREUM_RPC_PROVIDER,
  { chainId }
)

const stakingContractAddress = get(network, 'contracts.OGNStakingProxy.address')
const stakingContractABI = get(network, 'contracts.SingleAssetStaking.abi')

const stakingContract = !stakingContractAddress || !stakingContractABI ? null : new ethers.Contract(
  stakingContractAddress,
  stakingContractABI,
  jsonRpcProvider
)

const cors = Cors({
  methods: ['GET', 'HEAD'],
})

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result)
      }

      return resolve(result)
    })
  })
}

export default async function handler(req, res) {
  await runMiddleware(req, res, cors)

  if (!stakingContract) {
    return res.status(500).send({
      error: true
    })
  }

  const totalStaked = await stakingContract.totalOutstanding()
  const totalStakers = await stakingContract.totalStakers()

  return res.status(500).send({
    totalStaked: parseFloat(ethers.utils.formatUnits(totalStaked, 18)),
    totalStakers: parseInt(totalStakers.toString())
  })
}
