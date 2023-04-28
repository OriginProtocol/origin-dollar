import { ethers } from 'ethers'
import { displayCurrency } from 'utils/math'
import { isProduction } from 'constants/env'

let jsonCallId = 1

export default class BalancesService {
  async fetchBalances(account, contracts) {
    if (isProduction) {
      return this.fetchBalancesForProduction(account, contracts)
    }
    return this.fetchBalancesForDevelopment(account, contracts)
  }

  async fetchBalancesForProduction(account, contracts) {
    const { oeth, reth, weth, steth, frxeth, woeth } = contracts

    const allContractData = [
      { name: 'oeth', decimals: 18, contract: oeth, address: oeth.address },
      { name: 'reth', decimals: 18, contract: reth, address: reth.address },
      { name: 'weth', decimals: 18, contract: weth, address: weth.address },
      { name: 'steth', decimals: 18, contract: steth, address: steth.address },
      {
        name: 'frxeth',
        decimals: 18,
        contract: frxeth,
        address: frxeth.address,
      },
      { name: 'woeth', decimals: 18, contract: woeth, address: woeth.address },
    ]

    const data = {
      jsonrpc: '2.0',
      method: 'alchemy_getTokenBalances',
      params: [
        account,
        allContractData.map((contractData) => contractData.address),
      ],
      id: jsonCallId.toString(),
    }
    jsonCallId++

    const response = await fetch(
      process.env.NEXT_PUBLIC_ETHEREUM_RPC_PROVIDER,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        referrerPolicy: 'no-referrer',
        body: JSON.stringify(data),
      }
    )

    if (!response || !response.ok) {
      throw new Error(
        `Could not fetch balances from Alchemy http status: ${response.status}`
      )
    }

    const responseJson = await response.json()
    const balanceData = {}

    allContractData.forEach((contractData) => {
      const balanceResponseData = responseJson.result.tokenBalances.filter(
        (tokenBalanceData) =>
          tokenBalanceData.contractAddress.toLowerCase() ===
          contractData.contract.address.toLowerCase()
      )[0]

      if (!balanceResponseData.error) {
        balanceData[contractData.name] =
          balanceResponseData.tokenBalance === '0x'
            ? '0'
            : ethers.utils.formatUnits(
                balanceResponseData.tokenBalance,
                contractData.decimals
              )
      } else {
        console.error(
          `Can not load balance for ${contractData.name} reason: ${balanceResponseData.error}`
        )
      }
    })

    return balanceData
  }

  async fetchBalancesForDevelopment(account, contracts) {
    const { oeth, weth, reth, steth, frxeth, woeth } = contracts

    const [
      oethBalance,
      wethBalance,
      rethBalance,
      stethBalance,
      frxethBalance,
      // woethBalance,
    ] = await Promise.all([
      /* IMPORTANT (!) production uses a different method to load balances. Any changes here need to
       * also happen in production version of this function.
       */
      displayCurrency(await oeth.balanceOf(account), oeth),
      displayCurrency(await weth.balanceOf(account), weth),
      displayCurrency(await reth.balanceOf(account), reth),
      displayCurrency(await steth.balanceOf(account), steth),
      displayCurrency(await frxeth.balanceOf(account), frxeth),
      // displayCurrency(await woeth.balanceOf(account), woeth),
    ])

    return {
      oeth: oethBalance,
      weth: wethBalance,
      reth: rethBalance,
      steth: stethBalance,
      frxeth: frxethBalance,
      // woeth: woethBalance,
    }
  }
}

export const balancesService = new BalancesService()
