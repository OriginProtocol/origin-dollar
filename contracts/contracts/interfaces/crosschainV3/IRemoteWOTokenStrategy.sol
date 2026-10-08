// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @dev Inherited by `RemoteWOTokenStrategy`, so it declares only what that contract defines
///      itself. Members from its bases (`AbstractCrossChainV3Strategy` adapters / operator /
///      nonce state, `AbstractWOTokenStrategy.bridgeAsset`, `Governable`) are public getters or
///      non-virtual functions there and so can't be declared here.
interface IRemoteWOTokenStrategy {
    // Events
    event DepositProcessed(uint64 nonce, uint256 amount, uint256 remoteBalance);
    event WithdrawRequestProcessed(
        uint64 nonce,
        uint256 amount,
        uint256 requestId
    );
    event WithdrawClaimDelivered(
        uint64 nonce,
        uint256 amount,
        uint256 remoteBalance
    );
    event WithdrawClaimNack(uint64 nonce, uint256 remoteBalance);
    event RemoteWithdrawalClaimed(uint256 requestId, uint256 amount);
    event BalanceReportSent(
        uint64 nonce,
        uint256 remoteBalance,
        uint256 timestamp
    );
    /// @dev DEPOSIT mint/wrap reverted; bridgeAsset/oToken left idle (recoverable via retryDeposit).
    event DepositUnderlyingFailed(uint64 nonce, uint256 amount, bytes reason);
    /// @dev WITHDRAW_REQUEST unwrap/queue reverted; nothing queued, Master told to clear pending.
    event WithdrawRequestUnderlyingFailed(
        uint64 nonce,
        uint256 amount,
        bytes reason
    );
    /// @dev Operator re-ran the mint/wrap pipeline on idle bridgeAsset/oToken.
    event IdleDepositRetried(uint256 mintedBridgeAsset, uint256 wrappedOToken);

    // Lifecycle
    function initialize(address operator) external;

    function safeApproveAllTokens() external;

    // Operator entrypoints
    function sendBalanceReport() external payable;

    function retryDeposit() external;

    function claimRemoteWithdrawal() external;

    // Governance
    function transferToken(address asset, uint256 amount) external;

    // Views
    function checkBalance(address asset) external view returns (uint256);

    function oToken() external view returns (address);

    function woToken() external view returns (address);

    function oTokenVault() external view returns (address);

    function outstandingRequestId() external view returns (uint256);

    function outstandingRequestAmount() external view returns (uint256);
}
