import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { useAccount, useConnect, useSigner } from 'wagmi'
import ContractStore from 'stores/ContractStore'
import withRpcProvider from 'hoc/withRpcProvider'
import { ethers } from 'ethers'
import withIsMobile from 'hoc/withIsMobile'
import ConfirmationModal from './ConfirmationModal'
import { event } from '../../../lib/gtm'

const ApproveSwap = ({
  coinToApprove,
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

  const coinApproved = coinToApprove === 'eth' || stage === 'done'

  const isWrapped =
    selectedSwap && selectedSwap.name === 'woeth' && coinToApprove === 'oeth'

  const approvalNeeded =
    (selectedSwap &&
      !balanceError &&
      !swappingGloballyDisabled &&
      allowancesLoaded &&
      needsApproval) ||
    !coinApproved

  useEffect(() => {
    ContractStore.update((s) => {
      s.approvalNeeded = approvalNeeded
    })
  }, [approvalNeeded])

  const {
    vault,
    curveOETHPool,
    curveRegistryExchange,
    weth,
    reth,
    steth,
    frxeth,
    sfrxeth,
    oeth,
    woeth,
    zapper,
  } = useStoreState(ContractStore, (s) => s.contracts || {})

  const curveRegistryCoins = ['steth', 'weth', 'reth', 'frxeth']

  const routeConfig = {
    vault: {
      contract: vault,
      name: {
        approving: 'the OETH Vault',
        done: 'OETH Vault',
      },
    },
    zapper: {
      contract: zapper,
      name: {
        approving: 'the Zap + Vault',
        done: 'Zap + Vault',
      },
    },
    curve: {
      contract:
        // Use router address for LSDs, and if OETH is going to LSD via curve
        curveRegistryCoins.includes(coinToApprove) ||
        (coinToApprove === 'oeth' &&
          curveRegistryCoins.includes(selectedSwap?.coinToSwap) &&
          selectedSwap.name === 'curve')
          ? curveRegistryExchange
          : curveOETHPool,
      name: {
        approving: 'Curve',
        done: 'Curve',
      },
    },
    woeth: {
      contract: woeth,
      name: {
        approving: 'wOETH contract',
        done: 'wOETH contract',
      },
    },
  }

  useEffect(() => {
    if (selectedSwap) {
      if (
        isApproving.contract === selectedSwap.name &&
        isApproving.coin === coinToApprove
      ) {
        setStage('waiting-network')
        return
      }
    }
    setStage('approve')
  }, [JSON.stringify(selectedSwap), JSON.stringify(isApproving)])

  useEffect(() => {
    const coinToContract = { weth, reth, steth, sfrxeth, oeth, frxeth, woeth }
    if (Object.keys(coinToContract).includes(coinToApprove)) {
      setContract(coinToContract[coinToApprove])
    }
  }, [coinToApprove, reth, weth, steth, oeth, frxeth, woeth])

  const ApprovalMessage = ({
    stage,
    selectedSwap,
    coinToApprove,
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
    } to use your ${coinToApprove.toUpperCase()}`
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
    coinToApprove,
    swapsLoaded,
    selectedSwap,
    swappingGloballyDisabled,
    active,
  }) => {
    const coin =
      coinToApprove === 'woeth' ? 'wOETH' : coinToApprove.toUpperCase()
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
    } else if (coinToApprove === 'woeth') {
      return fbt('Unwrap', 'Unwrap')
    } else {
      return fbt('Swap', 'Swap')
    }
  }

  const startApprovalProcess = async () => {
    if (stage === 'approve' && contract) {
      event({
        event: 'approve_started',
        approval_type: isWrapped ? 'wrap' : 'swap',
        approval_token: coinToApprove,
      })
      setStage('waiting-user')
      try {
        const result = await contract
          .connect(signer)
          .approve(
            routeConfig[needsApproval]?.contract?.address,
            ethers.constants.MaxUint256
          )
        storeTransaction(
          result,
          isWrapped ? 'approveWrap' : 'approve',
          coinToApprove
        )
        setStage('waiting-network')
        setIsApproving({
          contract: needsApproval,
          coin: coinToApprove,
        })
        await rpcProvider.waitForTransaction(result.hash)
        event({
          event: 'approve_complete',
          approval_type: isWrapped ? 'wrap' : 'swap',
          approval_token: coinToApprove,
        })
        setIsApproving({})
        setStage('done')
      } catch (e) {
        onMintingError(e)
        console.error('Exception happened: ', e)
        setStage('approve')
        if (e.code !== 4001) {
          await storeTransactionError('approve', coinToApprove)
          event({
            event: 'approve_failed',
            approval_type: isWrapped ? 'wrap' : 'swap',
            approval_token: coinToApprove,
          })
        } else {
          event({
            event: 'approve_rejected',
            approval_type: isWrapped ? 'wrap' : 'swap',
            approval_token: coinToApprove,
          })
        }
      }
    }
  }

  const parsedAmount = parseFloat(inputAmount)

  return (
    <>
      {!visibleConfirmationModal ? null : (
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
        hidden={
          !needsApproval ||
          balanceError ||
          !approvalNeeded ||
          isNaN(parsedAmount) ||
          parsedAmount <= 0
        }
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
                coinToApprove={coinToApprove}
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
            coinToApprove={coinToApprove}
            swapsLoaded={swapsLoaded}
            selectedSwap={selectedSwap}
            swappingGloballyDisabled={swappingGloballyDisabled}
            active={active}
          />
        </button>
      </div>
      <style jsx>{`
        .btn-blue {
          padding: 20px 0;
          font-size: 20px;
          max-height: none;
        }

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

        @media (max-width: 799px) {
          .btn-blue {
            padding: 10px 0;
            font-size: 16px;
          }
        }
      `}</style>
    </>
  )
}

export default withIsMobile(withRpcProvider(ApproveSwap))
