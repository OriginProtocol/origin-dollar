// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IRemoteWOTokenStrategy {
    // Events (RemoteWOTokenStrategy)
    event DepositProcessed(uint64 nonce, uint256 amount, uint256 remoteBalance);
    event WithdrawClaimNack(uint64 nonce, uint256 remoteBalance);
    event RemoteWithdrawalClaimed(uint256 requestId, uint256 amount);
    event BalanceReportSent(
        uint64 nonce,
        uint256 remoteBalance,
        uint256 timestamp
    );
    event DepositUnderlyingFailed(uint64 nonce, uint256 amount, bytes reason);
    event IdleDepositRetried(uint256 mintedBridgeAsset, uint256 wrappedOToken);

    // Events (AbstractCrossChainV3Strategy)
    event YieldNonceAdvanced(uint64 nonce);
    event OutboundAdapterUpdated(address oldAdapter, address newAdapter);
    event InboundAdapterUpdated(address oldAdapter, address newAdapter);
    event OperatorUpdated(address oldOperator, address newOperator);

    // Lifecycle
    function initialize(address operator) external;

    function safeApproveAllTokens() external;

    // Operator entrypoints
    function sendBalanceReport() external payable;

    function retryDeposit() external;

    function claimRemoteWithdrawal() external;

    // Inbound
    function receiveMessage(
        address sender,
        address token,
        uint256 amountReceived,
        bytes calldata payload
    ) external;

    // Governance
    function setOutboundAdapter(address adapter) external;

    function setInboundAdapter(address adapter) external;

    function setOperator(address operator) external;

    function transferNative(uint256 amount) external;

    function transferToken(address asset, uint256 amount) external;

    // Views
    function checkBalance(address asset) external view returns (uint256);

    function isYieldOpInFlight() external view returns (bool);

    function lastYieldNonce() external view returns (uint64);

    function nonceProcessed(uint64 nonce) external view returns (bool);

    function lastBalanceCheckTimestamp() external view returns (uint256);

    function outboundAdapter() external view returns (address);

    function inboundAdapter() external view returns (address);

    function operator() external view returns (address);

    function bridgeAsset() external view returns (address);

    function oToken() external view returns (address);

    function woToken() external view returns (address);

    function oTokenVault() external view returns (address);

    function outstandingRequestId() external view returns (uint256);

    function outstandingRequestAmount() external view returns (uint256);
}
