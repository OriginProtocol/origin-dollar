import { fbt } from 'fbt-runtime'

const ApproveButtonLogic = ({
  formHasErrors,
  swappingGloballyDisabled,
  needsApproval,
  allowButtonState,
  onBuyNow,
  coin,

}) => {
  return (
    <button
      className={`btn-blue buy-button mb-2 w-100`}
      disabled={formHasErrors || swappingGloballyDisabled || !needsApproval || allowButtonState === 'approved'}
      onClick={onBuyNow}
    >
      {allowButtonState === 'allow' && (
        <img
          className="icon mr-3"
          src={`/images/currency/${coin}-icon-small.svg`}
        />
      )}

      <span>
        {swappingGloballyDisabled && process.env.DISABLE_SWAP_BUTTON_MESSAGE}
        {allowButtonState === 'allow' &&
          `Allow Origin Dollar to use your ${coin.toUpperCase()}`}
        {allowButtonState === 'waiting' &&
          fbt('Processing transaction...', 'Processing transaction...')}
        {allowButtonState === 'approved' &&
          fbt('Transaction complete', 'Transaction complete')}
      </span>
    </button>
  )
}

export default ApproveButtonLogic
