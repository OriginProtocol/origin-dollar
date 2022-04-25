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
    const { ousd, usdt, dai, usdc, ogn, wousd } = contracts

    const allContractData = [
      { name: 'ousd', decimals: 18, contract: ousd, address: ousd.address },
      { name: 'usdt', decimals: 6, contract: usdt, address: usdt.address },
      { name: 'dai', decimals: 18, contract: dai, address: dai.address },
      { name: 'usdc', decimals: 6, contract: usdc, address: usdc.address },
      { name: 'ogn', decimals: 18, contract: ogn, address: ogn.address },
      { name: 'wousd', decimals: 18, contract: wousd, address: wousd.address },
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

    const response = await fetch(process.env.ETHEREUM_RPC_PROVIDER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      referrerPolicy: 'no-referrer',
      body: JSON.stringify(data),
    })

    if (!response.ok) {
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

      if (balanceResponseData.error === null) {
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
    const { ousd, usdt, dai, usdc, ogn, wousd } = contracts

    const [
      ousdBalance,
      usdtBalance,
      daiBalance,
      usdcBalance,
      ognBalance,
      wousdBalance,
    ] = await Promise.all([
      /* IMPORTANT (!) production uses a different method to load balances. Any changes here need to
       * also happen in production version of this function.
       */
      displayCurrency(await ousd.balanceOf(account), ousd),
      displayCurrency(await usdt.balanceOf(account), usdt),
      displayCurrency(await dai.balanceOf(account), dai),
      displayCurrency(await usdc.balanceOf(account), usdc),
      displayCurrency(await ogn.balanceOf(account), ogn),
      displayCurrency(await wousd.balanceOf(account), wousd),
    ])

    return {
      ousd: ousdBalance,
      usdt: usdtBalance,
      dai: daiBalance,
      usdc: usdcBalance,
      ogn: ognBalance,
      wousd: wousdBalance,
    }
  }
}

export const balancesService = new BalancesService()
