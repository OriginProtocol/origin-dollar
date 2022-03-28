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
  const [coinApproved, setCoinApproved] = useState(false)
  const [stage, setStage] = useState(coinApproved ? 'done' : 'approve')
  const [contract, setContract] = useState(null)
  const web3react = useWeb3React()
  const { library, account } = web3react

  useEffect(() => {
    const approval = !(
      (!selectedSwap ||
        formHasErrors ||
        swappingGloballyDisabled ||
        !allowancesLoaded ||
        !needsApproval) &&
      !coinApproved
    )
    ContractStore.update((s) => {
      s.approvalNeeded = approval
    })
  }, [selectedSwap, needsApproval])

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

  const contracts = {
    vault: vault,
    flipper: flipper,
    uniswap: uniV3SwapRouter,
    curve: curveOUSDMetaPool,
    uniswapV2: uniV2Router,
    sushiswap: sushiRouter,
  }

  useEffect(() => {
    setCoinApproved(false)
    setStage('approve')
  }, [selectedSwap])

  useEffect(() => {
    if (stableCoinToApprove === 'dai') {
      setContract(dai)
    } else if (stableCoinToApprove === 'usdt') {
      setContract(usdt)
    } else if (stableCoinToApprove === 'usdc') {
      setContract(usdc)
    } else if (stableCoinToApprove === 'ousd') {
      setContract(ousd)
    }
  }, [stableCoinToApprove, usdt, dai, usdc, ousd])

  const ApprovalMessage = ({ needsApproval, stableCoinToApprove }) => {
    const capitalized = needsApproval.charAt(0).toUpperCase()
    const noncapitalized =
      needsApproval === 'uniswapV2'
        ? needsApproval.slice(1, 7)
        : needsApproval.slice(1)
    const flipper = needsApproval === 'flipper' ? 'the ' : ''
    const vault = needsApproval === 'vault' ? 'the Origin ' : ''
    const coin = stableCoinToApprove.toUpperCase()
    return (
      <>
        {isMobile
          ? fbt(
              'Approve ' +
                fbt.param('flipper', flipper) +
                fbt.param('vault', vault) +
                fbt.param('capatalized', capitalized) +
                fbt.param('noncapitalized', noncapitalized),
              'Approve coin'
            )
          : fbt(
              'Allow ' +
                fbt.param('flipper', flipper) +
                fbt.param('vault', vault) +
                fbt.param('capitalzed', capitalized) +
                fbt.param('noncapitalized', noncapitalized) +
                ' to use your ' +
                fbt.param('coin', coin),
              'Approve coin'
            )}
      </>
    )
  }

  return (
    <>
      <button
        className={`btn-blue buy-button mt-4 mt-md-3 w-100`}
        hidden={
          (!selectedSwap ||
            formHasErrors ||
            swappingGloballyDisabled ||
            !allowancesLoaded ||
            !needsApproval) &&
          !coinApproved
        }
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
              const maximum = ethers.constants.MaxUint256
              const result = await contract
                .connect(library.getSigner(account))
                .approve(contracts[needsApproval].address, maximum)
              storeTransaction(result, 'approve', stableCoinToApprove)
              setStage('waiting-network')

              const receipt = await rpcProvider.waitForTransaction(result.hash)
              analytics.track('Approval Successful', {
                category: 'swap',
                label: swapMetadata.coinGiven,
                value: parseInt(swapMetadata.swapAmount),
              })
              setCoinApproved(true)
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
            {stage === 'approve' && needsApproval && (
              <ApprovalMessage
                needsApproval={needsApproval}
                stableCoinToApprove={stableCoinToApprove}
              />
            )}
            {stage === 'waiting-user' && (
              <>
                {fbt(
                  'Waiting for you to confirm...',
                  'Waiting for you to confirm...'
                )}
              </>
            )}
            {stage === 'waiting-network' && (
              <>
                {fbt(
                  'Approving ' +
                    fbt.param(
                      'coin-name',
                      stableCoinToApprove.toUpperCase() + '...'
                    ),
                  'Approving coin'
                )}
              </>
            )}
            {stage === 'done' && (
              <>
                {fbt(
                  fbt.param(
                    'coin-name',
                    stableCoinToApprove.toUpperCase() + ' approved'
                  ),
                  'Coin approved'
                )}
              </>
            )}
          </>
        )}
      </button>
      <div className="d-flex flex-column align-items-center justify-content-center justify-content-md-between flex-md-row mt-md-3 mt-2">
        <a
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          className="link-detail"
        ></a>
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
