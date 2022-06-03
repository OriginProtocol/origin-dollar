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
  balanceError,
  swapsLoaded,
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
  const isWrapped =
    selectedSwap &&
    selectedSwap.name === 'wousd' &&
    stableCoinToApprove === 'ousd'
  const approvalNeeded =
    (selectedSwap &&
      !balanceError &&
      !swappingGloballyDisabled &&
      allowancesLoaded &&
      needsApproval) ||
    coinApproved

  useEffect(() => {
    ContractStore.update((s) => {
      s.approvalNeeded = approvalNeeded
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
    wousd,
  } = useStoreState(ContractStore, (s) => s.contracts || {})

  const routeConfig = {
    vault: {
      contract: vault,
      name: {
        approving: 'the Origin Vault',
        done: 'Origin Vault',
      },
    },
    flipper: {
      contract: flipper,
      name: {
        approving: 'the Flipper',
        done: 'Flipper',
      },
    },
    uniswap: {
      contract: uniV3SwapRouter,
      name: {
        approving: 'Uniswap',
        done: 'Uniswap',
      },
    },
    curve: {
      contract: curveOUSDMetaPool,
      name: {
        approving: 'Curve',
        done: 'Curve',
      },
    },
    uniswapV2: {
      contract: uniV2Router,
      name: {
        approving: 'Uniswap',
        done: 'Uniswap',
      },
    },
    sushiswap: {
      contract: sushiRouter,
      name: {
        approving: 'Sushi Swap',
        done: 'Sushi Swap',
      },
    },
    wousd: {
      contract: wousd,
      name: {
        approving: 'wOUSD',
        done: 'wOUSD',
      },
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
    const coinToContract = { dai, usdt, usdc, ousd, wousd }
    if (Object.keys(coinToContract).includes(stableCoinToApprove)) {
      setContract(coinToContract[stableCoinToApprove])
    }
  }, [stableCoinToApprove, usdt, dai, usdc, ousd, wousd])

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
      const waitingNetworkMessage =
        routeConfig[selectedSwap.name].name.approving
      return fbt(
        'Approving ' +
          fbt.param('waiting-network', waitingNetworkMessage) +
          '...',
        'Approving contract'
      )
    }
    if (stage === 'done') {
      const doneMessage = routeConfig[selectedSwap.name].name.done
      return fbt(
        fbt.param('approval-done', doneMessage) + ' approved',
        'Contract approved'
      )
    }

    const route = `${
      routeConfig[selectedSwap.name].name.approving
    } to use your ${stableCoinToApprove.toUpperCase()}`
    const routeMobile = `${routeConfig[selectedSwap.name].name.approving}`

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

  const SwapMessage = ({
    balanceError,
    stableCoinToApprove,
    swapsLoaded,
    selectedSwap,
    swappingGloballyDisabled,
  }) => {
    const coin =
      stableCoinToApprove === 'wousd'
        ? 'wOUSD'
        : stableCoinToApprove.toUpperCase()
    const noSwapRouteAvailable = swapsLoaded && !selectedSwap
    if (swappingGloballyDisabled) {
      return process.env.DISABLE_SWAP_BUTTON_MESSAGE
    } else if (balanceError) {
      return fbt(
        'Insufficient ' + fbt.param('coin', coin) + ' balance',
        'Insufficient balance'
      )
    } else if (noSwapRouteAvailable) {
      return fbt(
        'Route for selected swap not available',
        'No route available for selected swap'
      )
    } else if (isWrapped) {
      return fbt('Wrap', 'Wrap')
    } else if (stableCoinToApprove === 'wousd') {
      return fbt('Unwrap', 'Unwrap')
    } else {
      return fbt('Swap', 'Swap')
    }
  }

  return (
    <>
      <button
        className={`btn-blue buy-button mt-4 mt-md-3 w-100`}
        hidden={!approvalNeeded}
        disabled={coinApproved}
        onClick={async () => {
          if (stage === 'approve' && contract) {
            analytics.track('On Approve Coin', {
              category: isWrapped ? 'wrap' : 'swap',
              label: swapMetadata.coinGiven,
              value: parseInt(swapMetadata.swapAmount),
            })
            setStage('waiting-user')
            try {
              const result = await contract
                .connect(library.getSigner(account))
                .approve(
                  routeConfig[needsApproval].contract.address,
                  ethers.constants.MaxUint256
                )
              storeTransaction(
                result,
                isWrapped ? 'approveWrap' : 'approve',
                stableCoinToApprove
              )
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
                  category: isWrapped ? 'wrap' : 'swap',
                  label: e.message,
                })
              } else {
                analytics.track(`Approval canceled`, {
                  category: isWrapped ? 'wrap' : 'swap',
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
            balanceError ||
            swappingGloballyDisabled ||
            (needsApproval && !coinApproved)
          }
          onClick={onSwap}
        >
          <SwapMessage
            balanceError={balanceError}
            stableCoinToApprove={stableCoinToApprove}
            swapsLoaded={swapsLoaded}
            selectedSwap={selectedSwap}
            swappingGloballyDisabled={swappingGloballyDisabled}
          />
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
