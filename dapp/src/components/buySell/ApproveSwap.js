import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { useAccount, useConnect, useSigner } from 'wagmi'
import ContractStore from 'stores/ContractStore'
import withRpcProvider from 'hoc/withRpcProvider'
import { ethers } from 'ethers'
import withIsMobile from 'hoc/withIsMobile'
import ConfirmationModal from './ConfirmationModal'
import GetOUSD from '../GetOUSD'

const ApproveSwap = ({
  stableCoinToApprove,
  needsApproval,
  selectedSwap,
  inputAmount,
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
  showLogin,
}) => {
  const [visibleConfirmationModal, setVisibleConfirmationModal] = useState(0)
  const lastOverride = useStoreState(ContractStore, (s) => s.lastOverride)
  const [stage, setStage] = useState('approve')
  const [contract, setContract] = useState(null)
  const [isApproving, setIsApproving] = useState({})

  const { address: account, isConnected: active } = useAccount()
  const { connect: activate } = useConnect()
  const { data: signer } = useSigner()

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
    active,
  }) => {
    const coin =
      stableCoinToApprove === 'wousd'
        ? 'wOUSD'
        : stableCoinToApprove.toUpperCase()
    const noSwapRouteAvailable = swapsLoaded && !selectedSwap
    if (swappingGloballyDisabled) {
      return process.env.NEXT_PUBLIC_DISABLE_SWAP_BUTTON_MESSAGE
    } else if (!active) {
      return fbt('Connect Wallet', 'Connect Wallet')
    } else if (balanceError) {
      return fbt(
        'Insufficient ' + fbt.param('coin', coin) + ' balance',
        'Insufficient balance'
      )
    } else if (noSwapRouteAvailable) {
      return fbt('Insufficient liquidity', 'Insufficient liquidity')
    } else if (isWrapped) {
      return fbt('Wrap', 'Wrap')
    } else if (stableCoinToApprove === 'wousd') {
      return fbt('Unwrap', 'Unwrap')
    } else {
      return fbt('Swap', 'Swap')
    }
  }

  const startApprovalProcess = async () => {
    if (stage === 'approve' && contract) {
      setStage('waiting-user')
      try {
        const result = await contract
          .connect(signer)
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
        await rpcProvider.waitForTransaction(result.hash)
        setIsApproving({})
        setStage('done')
      } catch (e) {
        onMintingError(e)
        console.error('Exception happened: ', e)
        setStage('approve')
        if (e.code !== 4001) {
          await storeTransactionError('approve', stableCoinToApprove)
        }
      }
    }
  }

  return (
    <>
      {!!visibleConfirmationModal && (
        <ConfirmationModal
          description={fbt(
            'Your contract selection has been changed to ' +
              fbt.param('new contract name', selectedSwap?.name) +
              '. If you want your transaction to be routed through ' +
              fbt.param('abandoned contract name', lastOverride) +
              ', you can go back and override it. Do you want to continue with the default selection?',
            'Confirm approval'
          )}
          onClose={() => {
            setVisibleConfirmationModal(0)
          }}
          onConfirm={() => {
            setVisibleConfirmationModal(0)
            ContractStore.update((s) => {
              s.lastOverride = selectedSwap?.name
            })
            visibleConfirmationModal === 1 ? startApprovalProcess() : onSwap()
          }}
          declineBtnText={fbt('No', 'Not confirm')}
          confirmBtnText={fbt('Go ahead', 'Yes, Go ahead')}
        />
      )}
      <button
        className={`btn-blue buy-button mt-4 mt-md-3 w-100`}
        hidden={!approvalNeeded}
        disabled={coinApproved}
        onClick={() => {
          if (lastOverride && lastOverride !== selectedSwap?.name) {
            setVisibleConfirmationModal(1)
          } else {
            startApprovalProcess()
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
      {active ? (
        <div className="d-flex flex-column align-items-center justify-content-center justify-content-md-between flex-md-row mt-md-3 mt-2">
          <button
            className={`btn-blue buy-button mt-2 mt-md-0 w-100`}
            disabled={
              (!selectedSwap ||
                balanceError ||
                swappingGloballyDisabled ||
                (needsApproval && !coinApproved)) &&
              active
            }
            onClick={() => {
              if (lastOverride && lastOverride !== selectedSwap?.name) {
                setVisibleConfirmationModal(2)
              } else {
                onSwap()
              }
            }}
          >
            <SwapMessage
              balanceError={balanceError}
              stableCoinToApprove={stableCoinToApprove}
              swapsLoaded={swapsLoaded}
              selectedSwap={selectedSwap}
              swappingGloballyDisabled={swappingGloballyDisabled}
              active={active}
            />
          </button>
        </div>
      ) : (
        <div className="d-flex flex-column align-items-center justify-content-center justify-content-md-between flex-md-row mt-md-3 mt-2">
          <div className={`btn-blue buy-button mt-2 mt-md-0 w-100`}>
            <GetOUSD
              containerClassName="w-100 h-100 d-flex align-items-center justify-content-center"
              className="w-100 h-100"
              trackSource="Swap connect wallet"
            />
          </div>
        </div>
      )}
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
