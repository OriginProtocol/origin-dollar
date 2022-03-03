import { ethers } from 'ethers'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import ContractStore from 'stores/ContractStore'
import analytics from 'utils/analytics'
import { assetRootPath } from 'utils/image'
import { useWeb3React } from '@web3-react/core'
import Media from 'react-media'

const ApproveButtonLogic = forwardRef(
  (
    {
      formHasErrors,
      swappingGloballyDisabled,
      needsApproval,
      allowButtonState,
      setAllowButtonState,
      onBuyNow,
      storeTransaction,
      storeTransactionError,
      onMintingError,
      rpcProvider,
      swapMetadata,
      swapMode,
      coin,
    },
    ref
  ) => {
    const [contract, setContract] = useState(null)
    const { library, account } = useWeb3React()

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

    const contractMap = {
      vault: vault,
      flipper: flipper,
      uniswap: uniV3SwapRouter,
      curve: curveOUSDMetaPool,
      uniswapV2: uniV2Router,
      sushiswap: sushiRouter,
    }

    useEffect(() => {
      if (coin === 'dai') {
        setContract(dai)
      } else if (coin === 'usdt') {
        setContract(usdt)
      } else if (coin === 'usdc') {
        setContract(usdc)
      } else if (coin === 'ousd') {
        setContract(ousd)
      }
    }, [])

    useImperativeHandle(ref, () => ({
      async approve() {
        analytics.track('On Approve Coin', {
          category: 'swap',
          label: swapMetadata.coinGiven,
          value: parseInt(swapMetadata.swapAmount),
        })
        setAllowButtonState('waiting')
        try {
          const maximum = ethers.constants.MaxUint256
          const result = await contract
            .connect(library.getSigner(account))
            .approve(contractMap[needsApproval].address, maximum)
          storeTransaction(result, 'approve', coin)
          const receipt = await rpcProvider.waitForTransaction(result.hash)
          analytics.track('Approval Successful', {
            category: 'swap',
            label: swapMetadata.coinGiven,
            value: parseInt(swapMetadata.swapAmount),
          })
          setAllowButtonState('approved')
        } catch (e) {
          onMintingError(e)
          console.error('Exception happened: ', e)
          setAllowButtonState('allow')

          if (e.code !== 4001) {
            await storeTransactionError(
              'approve',
              swapMode === 'mint' ? coin : 'ousd'
            )
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
      },
    }))

    const contractName = (contract) => {
      if (contract === 'flipper') {
        return fbt('the Flipper', 'the Flipper')
      }
      if (contract === 'vault') {
        return fbt('the Origin Vault', 'the Origin Vault')
      }
      if (contract === 'curve') {
        return fbt('Curve', 'Curve')
      }
      if (contract === 'sushiswap') {
        return fbt('SushiSwap', 'SushiSwap')
      }
      if (contract === 'uniswapV2' || contract === 'uniswap') {
        return fbt('Uniswap', 'Uniswap')
      }
    }

    return (
      <button
        className={`btn-blue buy-button mb-2 w-100`}
        disabled={
          formHasErrors ||
          swappingGloballyDisabled ||
          !needsApproval ||
          allowButtonState === 'approved'
        }
        onClick={onBuyNow}
      >
        {/* {allowButtonState === 'allow' && (
          <img
            className="icon mr-3"
            src={assetRootPath(`/images/currency/${coin}-icon-small.svg`)}
          />
        )} */}

        <span>
          {swappingGloballyDisabled && process.env.DISABLE_SWAP_BUTTON_MESSAGE}
          <Media query={{ minWidth: 570 }}>
            {(matches) =>
              matches
                ? allowButtonState === 'allow' &&
                  fbt(
                    'Allow ' +
                      fbt.param('contract', contractName(needsApproval)) +
                      ' to use your ' +
                      fbt.param('coin-name', coin.toUpperCase()),
                    'permission to use coin'
                  )
                : allowButtonState === 'allow' &&
                  fbt(
                    'Allow ' +
                      fbt.param('contract', contractName(needsApproval)),
                    'permission to use coin'
                  )
            }
          </Media>

          {allowButtonState === 'waiting' &&
            fbt('Processing transaction...', 'Processing transaction...')}
          {allowButtonState === 'approved' &&
            fbt('Transaction complete', 'Transaction complete')}
        </span>
      </button>
    )
  }
)

export default ApproveButtonLogic
