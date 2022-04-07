import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { useWeb3React } from '@web3-react/core'
import ContractStore from 'stores/ContractStore'
import analytics from 'utils/analytics'
import withRpcProvider from 'hoc/withRpcProvider'
import { ethers } from 'ethers'
import withIsMobile from 'hoc/withIsMobile'

const ApproveSwap = ({
  stableCoinToApprove,
  needsApproval,
  selectedSwap,
  swapMetadata,
  onSwap,
  allowancesLoaded,
  onMintingError,
  formHasErrors,
  swappingGloballyDisabled,
  storeTransaction,
  storeTransactionError,
  rpcProvider,
  isMobile,
}) => {
  const [stage, setStage] = useState('approve')
  const [contract, setContract] = useState(null)
  const [isApproving, setIsApproving] = useState({})
  const web3react = useWeb3React()
  const { library, account } = web3react
  const coinApproved = stage === 'done'

  const approvalNeeded =
    (!selectedSwap ||
      formHasErrors ||
      swappingGloballyDisabled ||
      !allowancesLoaded ||
      !needsApproval) &&
    !coinApproved

  useEffect(() => {
    ContractStore.update((s) => {
      s.approvalNeeded = !approvalNeeded
    })
  }, [approvalNeeded])

  const {
    vault,
    flipper,
    uniV3SwapRouter,
    uniV2Router,
    sushiRouter,
    curveOUSDMetaPool,
    usdt,
    dai,
    usdc,
    ousd,
  } = useStoreState(ContractStore, (s) => s.contracts || {})

  function alterFirstLetterCase(string, forceUpperCase) {
    return (forceUpperCase ? string.charAt(0).toUpperCase() : string.charAt(0)) + string.slice(1);
  }

  const routeConfig = {
    vault: {
      contract: vault,
      name: (forceUpperCase) => alterFirstLetterCase('the Origin Vault', forceUpperCase),
    },
    flipper: {
      contract: flipper,
      name: (forceUpperCase) => alterFirstLetterCase('the Flipper', forceUpperCase)
    },
    uniswap: {
      contract: uniV3SwapRouter,
      name: (forceUpperCase) => alterFirstLetterCase('Uniswap', forceUpperCase)
    },
    curve: {
      contract: curveOUSDMetaPool,
      name: (forceUpperCase) => alterFirstLetterCase('Curve', forceUpperCase)
    },
    uniswapV2: {
      contract: uniV2Router,
      name: (forceUpperCase) => alterFirstLetterCase('Uniswap', forceUpperCase)
    },
    sushiswap: {
      contract: sushiRouter,
      name: (forceUpperCase) => alterFirstLetterCase('Sushi Swap', forceUpperCase)
    },
  }

  useEffect(() => {
    if (selectedSwap) {
      if (
        isApproving.contract === selectedSwap.name &&
        isApproving.coin === stableCoinToApprove
      ) {
        setStage('waiting-network')
        return
      }
    }
    setStage('approve')
  }, [selectedSwap])

  useEffect(() => {
    const coinToContract = { dai, usdt, usdc, ousd }
    if (Object.keys(coinToContract).includes(stableCoinToApprove)) {
      setContract(coinToContract[stableCoinToApprove])
    }
  }, [stableCoinToApprove, usdt, dai, usdc, ousd])

  const ApprovalMessage = ({
    stage,
    selectedSwap,
    stableCoinToApprove,
    isMobile,
  }) => {
    if (stage === 'waiting-user') {
      return fbt(
        'Waiting for you to confirm...',
        'Waiting for you to confirm...'
      )
    }
    if (stage === 'waiting-network') {
      const waitingNetworkMessage = routeConfig[selectedSwap.name].name(false)
      return fbt(
        'Approving ' +
          fbt.param('waiting-network', waitingNetworkMessage) +
          '...',
        'Approving contract'
      )
    }
    if (stage === 'done') {
      const doneMessage = routeConfig[selectedSwap.name].name(true)
      return fbt(
        fbt.param('approval-done', doneMessage) + ' approved',
        'Contract approved'
      )
    }

    const route = `${routeConfig[selectedSwap.name].name(false)} to use your ${stableCoinToApprove.toUpperCase()}`
    const routeMobile = `${routeConfig[selectedSwap.name].name(false)}`

    return (
      <>
        {isMobile
          ? fbt(
              'Approve ' + fbt.param('route-mobile', routeMobile),
              'Approve contract'
            )
          : fbt('Allow ' + fbt.param('route', route), 'Approve contract')}
      </>
    )
  }

  return (
    <>
      <button
        className={`btn-blue buy-button mt-4 mt-md-3 w-100`}
        hidden={approvalNeeded}
        disabled={coinApproved}
        onClick={async () => {
          if (stage === 'approve' && contract) {
            analytics.track('On Approve Coin', {
              category: 'swap',
              label: swapMetadata.coinGiven,
              value: parseInt(swapMetadata.swapAmount),
            })
            setStage('waiting-user')
            try {
              const result = await contract
                .connect(library.getSigner(account))
                .approve(routeConfig[needsApproval].contract.address, ethers.constants.MaxUint256)
              storeTransaction(result, 'approve', stableCoinToApprove)
              setStage('waiting-network')
              setIsApproving({
                contract: needsApproval,
                coin: stableCoinToApprove,
              })
              const receipt = await rpcProvider.waitForTransaction(result.hash)
              analytics.track('Approval Successful', {
                category: 'swap',
                label: swapMetadata.coinGiven,
                value: parseInt(swapMetadata.swapAmount),
              })
              setIsApproving({})
              setStage('done')
            } catch (e) {
              onMintingError(e)
              console.error('Exception happened: ', e)
              setStage('approve')
              if (e.code !== 4001) {
                await storeTransactionError('approve', stableCoinToApprove)
                analytics.track(`Approval failed`, {
                  category: 'swap',
                  label: e.message,
                })
              } else {
                analytics.track(`Approval canceled`, {
                  category: 'swap',
                })
              }
            }
          }
        }}
      >
        {!swappingGloballyDisabled && (
          <>
            {selectedSwap && (
              <ApprovalMessage
                stage={stage}
                selectedSwap={selectedSwap}
                stableCoinToApprove={stableCoinToApprove}
                isMobile={isMobile}
              />
            )}
          </>
        )}
      </button>
      <div className="d-flex flex-column align-items-center justify-content-center justify-content-md-between flex-md-row mt-md-3 mt-2">
        <button
          className={`btn-blue buy-button mt-2 mt-md-0 w-100`}
          disabled={
            !selectedSwap ||
            formHasErrors ||
            swappingGloballyDisabled ||
            (needsApproval && !coinApproved)
          }
          onClick={onSwap}
        >
          {swappingGloballyDisabled && process.env.DISABLE_SWAP_BUTTON_MESSAGE}
          {!swappingGloballyDisabled && fbt('Swap', 'Swap')}
        </button>
      </div>
      <style jsx>{`
        .btn-blue:disabled {
          opacity: 0.4;
        }

        button:focus {
          opacity: 1;
        }

        button:hover {
          background-color: #0a72ef;
          opacity: 1;
        }

        .link-detail {
          font-size: 12px;
          color: #1a82ff;
        }

        .link-detail:hover {
          color: #3aa2ff;
        }
      `}</style>
    </>
  )
}

export default withIsMobile(withRpcProvider(ApproveSwap))
