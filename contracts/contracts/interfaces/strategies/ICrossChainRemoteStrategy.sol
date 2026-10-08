// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ICrossChainRemoteStrategy {
    // Events (from InitializableAbstractStrategy)
    event Deposit(address indexed _asset, address _pToken, uint256 _amount);
    event Withdrawal(address indexed _asset, address _pToken, uint256 _amount);
    event RewardTokenCollected(
        address recipient,
        address rewardToken,
        uint256 amount
    );
    event PTokenAdded(address indexed _asset, address _pToken);
    event PTokenRemoved(address indexed _asset, address _pToken);
    event RewardTokenAddressesUpdated(
        address[] _oldAddresses,
        address[] _newAddresses
    );
    event HarvesterAddressesUpdated(
        address _oldHarvesterAddress,
        address _newHarvesterAddress
    );

    // Events (from AbstractCCTPIntegrator)
    event LastTransferNonceUpdated(uint64 lastTransferNonce);
    event NonceProcessed(uint64 nonce);
    event CCTPMinFinalityThresholdSet(uint16 minFinalityThreshold);
    event CCTPFeePremiumBpsSet(uint16 feePremiumBps);
    event OperatorChanged(address operator);
    event TokensBridged(
        uint64 nonce,
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        uint256 minFinalityThreshold,
        uint256 maxFee
    );
    event MessageTransmitted(
        uint64 nonce,
        uint32 destinationDomain,
        bytes32 recipient,
        uint256 minFinalityThreshold
    );

    // Events (CrossChainRemoteStrategy-specific)
    event DepositUnderlyingFailed(string reason);
    event WithdrawalFailed(uint256 amountRequested, uint256 amountAvailable);
    event WithdrawUnderlyingFailed(string reason);

    // IStrategy functions
    function deposit(address _asset, uint256 _amount) external;

    function depositAll() external;

    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external;

    function withdrawAll() external;

    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance);

    function supportsAsset(address _asset) external view returns (bool);

    function collectRewardTokens() external;

    function getRewardTokenAddresses() external view returns (address[] memory);

    function harvesterAddress() external view returns (address);

    function transferToken(address token, uint256 amount) external;

    function setRewardTokenAddresses(address[] calldata _rewardTokenAddresses)
        external;

    // InitializableAbstractStrategy functions
    function platformAddress() external view returns (address);

    function vaultAddress() external view returns (address);

    function setHarvesterAddress(address _harvesterAddress) external;

    function safeApproveAllTokens() external;

    function rewardTokenAddresses(uint256 _index)
        external
        view
        returns (address);

    function setPTokenAddress(address _asset, address _pToken) external;

    function assetToPToken(address _asset) external view returns (address);

    // Governable
    function governor() external view returns (address);

    function isGovernor() external view returns (bool);

    // Strategizable
    function strategistAddr() external view returns (address);

    function setStrategistAddr(address _address) external;

    // AbstractCCTPIntegrator functions
    function operator() external view returns (address);

    function minFinalityThreshold() external view returns (uint16);

    function feePremiumBps() external view returns (uint16);

    function lastTransferNonce() external view returns (uint64);

    function isNonceProcessed(uint64 nonce) external view returns (bool);

    function isTransferPending() external view returns (bool);

    function setOperator(address _operator) external;

    function setMinFinalityThreshold(uint16 _minFinalityThreshold) external;

    function setFeePremiumBps(uint16 _feePremiumBps) external;

    function handleReceiveFinalizedMessage(
        uint32 sourceDomainID,
        bytes32 sender,
        uint32 minFinalityLevel,
        bytes calldata messageBody
    ) external returns (bool);

    function handleReceiveUnfinalizedMessage(
        uint32 sourceDomainID,
        bytes32 sender,
        uint32 minFinalityLevel,
        bytes calldata messageBody
    ) external returns (bool);

    function relay(bytes memory message, bytes memory attestation) external;

    // CCTP config view functions
    function cctpMessageTransmitter() external view returns (address);

    function cctpTokenMessenger() external view returns (address);

    function usdcToken() external view returns (address);

    function peerUsdcToken() external view returns (address);

    function peerDomainID() external view returns (uint32);

    function peerStrategy() external view returns (address);

    function MAX_TRANSFER_AMOUNT() external view returns (uint256);

    function MIN_TRANSFER_AMOUNT() external view returns (uint256);

    // Generalized4626Strategy / CrossChainRemoteStrategy-specific functions
    function initialize(
        address _strategist,
        address _operator,
        uint16 _minFinalityThreshold,
        uint16 _feePremiumBps
    ) external;

    function sendBalanceUpdate() external;

    function shareToken() external view returns (address);

    function assetToken() external view returns (address);
}
