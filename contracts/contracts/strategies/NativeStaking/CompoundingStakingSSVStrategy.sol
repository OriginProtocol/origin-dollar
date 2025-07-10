// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";
import { CompoundingValidatorManager } from "./CompoundingValidatorManager.sol";

/// @title Compounding Staking SSV Strategy
/// @notice Strategy to deploy funds into DVT validators powered by the SSV Network
/// @author Origin Protocol Inc
/// @dev This contract handles WETH and ETH and in some operations interchanges between the two. Any WETH that
/// is on the contract across multiple blocks (and not just transitory within a transaction) is considered an
/// asset. Meaning deposits increase the balance of the asset and withdrawal decrease it. As opposed to all
/// our other strategies the WETH doesn't immediately get deposited into an underlying strategy and can be present
/// across multiple blocks waiting to be unwrapped to ETH and staked to validators. This separation of WETH and ETH is
/// required since the rewards (reward token) is also in ETH.
///
/// To simplify the accounting of WETH there is another difference in behavior compared to the other strategies.
/// To withdraw WETH asset - exit message is posted to validators and the ETH hits this contract with multiple days
/// delay. In order to simplify the WETH accounting upon detection of such an event the ValidatorAccountant
/// immediately wraps ETH to WETH and sends it to the Vault.
///
/// On the other hand any ETH on the contract (across multiple blocks) is there either:
///  - as a result of already accounted for consensus rewards
///  - as a result of not yet accounted for consensus rewards
///  - as a results of not yet accounted for full validator withdrawals (or validator slashes)
///
/// Even though the strategy assets and rewards are a very similar asset the consensus layer rewards and the
/// execution layer rewards are considered rewards and those are dripped to the Vault over a configurable time
/// interval and not immediately.
contract CompoundingStakingSSVStrategy is
    CompoundingValidatorManager,
    InitializableAbstractStrategy
{
    /// @notice SSV ERC20 token that serves as a payment for operating SSV validators
    address public immutable SSV_TOKEN;

    // For future use
    uint256[50] private __gap;

    /// @param _baseConfig Base strategy config with platformAddress (ERC-4626 Vault contract), eg sfrxETH or sDAI,
    /// and vaultAddress (OToken Vault contract), eg VaultProxy or OETHVaultProxy
    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _ssvToken Address of the Erc20 SSV Token contract
    /// @param _ssvNetwork Address of the SSV Network contract
    /// @param _beaconChainDepositContract Address of the beacon chain deposit contract
    /// @param _beaconOracle Address of the Beacon Oracle contract that maps block numbers to slots
    /// @param _beaconProofs Address of the Beacon Proofs contract that verifies beacon chain data
    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _wethAddress,
        address _ssvToken,
        address _ssvNetwork,
        address _beaconChainDepositContract,
        address _beaconOracle,
        address _beaconProofs
    )
        InitializableAbstractStrategy(_baseConfig)
        CompoundingValidatorManager(
            _wethAddress,
            _baseConfig.vaultAddress,
            _beaconChainDepositContract,
            _ssvNetwork,
            _beaconOracle,
            _beaconProofs
        )
    {
        SSV_TOKEN = _ssvToken;
    }

    /// @notice Set up initial internal state including
    /// 1. approving the SSVNetwork to transfer SSV tokens from this strategy contract
    /// 2. setting the recipient of SSV validator MEV rewards to the FeeAccumulator contract.
    /// @param _rewardTokenAddresses Address of reward token for platform
    /// @param _assets Addresses of initial supported assets
    /// @param _pTokens Platform Token corresponding addresses
    function initialize(
        address[] memory _rewardTokenAddresses,
        address[] memory _assets,
        address[] memory _pTokens
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );

        // Approves the SSV Network contract to transfer SSV tokens for deposits
        IERC20(SSV_TOKEN).approve(SSV_NETWORK, type(uint256).max);
    }

    /// @notice Unlike other strategies, this does not deposit assets into the underlying platform.
    /// It just checks the asset is WETH and emits the Deposit event.
    /// To deposit WETH into validators `registerSsvValidator` and `stakeEth` must be used.
    /// Will NOT revert if the strategy is paused for validator consolidation.
    /// @param _asset Address of asset to deposit. Has to be WETH.
    /// @param _amount Amount of assets that were transferred to the strategy by the vault.
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        require(_asset == WETH, "Unsupported asset");
        require(_amount > 0, "Must deposit something");

        // Account for the new WETH
        depositedWethAccountedFor += _amount;

        emit Deposit(_asset, address(0), _amount);
    }

    /// @notice Unlike other strategies, this does not deposit assets into the underlying platform.
    /// It just emits the Deposit event.
    /// To deposit WETH into validators `registerSsvValidator` and `stakeEth` must be used.
    /// Will NOT revert if the strategy is paused for validator consolidation.
    function depositAll() external override onlyVault nonReentrant {
        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        uint256 newWeth = wethBalance - depositedWethAccountedFor;

        if (newWeth > 0) {
            // Account for the new WETH
            depositedWethAccountedFor = wethBalance;

            emit Deposit(WETH, address(0), newWeth);
        }
    }

    /// @notice Withdraw ETH and WETH from this strategy contract.
    /// Will revert if the strategy is paused for validator consolidation.
    /// @param _recipient Address to receive withdrawn assets
    /// @param _asset WETH to withdraw
    /// @param _amount Amount of WETH to withdraw
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant whenNotPaused {
        require(_asset == WETH, "Unsupported asset");

        _withdraw(_recipient, _asset, _amount, address(this).balance);
    }

    function _withdraw(
        address _recipient,
        address _asset,
        uint256 _withdrawAmount,
        uint256 _ethBalance
    ) internal {
        require(_withdrawAmount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");

        // Convert any ETH from validator partial withdrawals, exits
        // or execution rewards to WETH and do the necessary accounting.
        if (_ethBalance > 0) _convertWethToEth(_ethBalance);

        // Transfer WETH to the recipient and do the necessary accounting.
        _transferWeth(_withdrawAmount, _recipient);

        emit Withdrawal(_asset, address(0), _withdrawAmount);
    }

    /// @notice Transfer all WETH deposits, ETH from validator withdrawals and ETH from
    /// execution rewards in this strategy to the vault.
    /// This does not withdraw from the validators. That has to be done separately with the
    /// `validatorWithdrawal` operation.
    /// Will revert if the strategy is paused for validator consolidation.
    function withdrawAll()
        external
        override
        onlyVaultOrGovernor
        nonReentrant
        whenNotPaused
    {
        uint256 ethBalance = address(this).balance;
        uint256 withdrawAmount = IERC20(WETH).balanceOf(address(this)) +
            ethBalance;

        if (withdrawAmount > 0) {
            _withdraw(vaultAddress, WETH, withdrawAmount, ethBalance);
        }
    }

    /// @notice Returns the last verified balance of validator deposits, validator balance,
    /// WETH and ETH in the strategy contract.
    /// @param _asset      Address of weth asset
    /// @return balance    Total value of (W)ETH
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        require(_asset == WETH, "Unsupported asset");

        // Load the last verified balance from the storage
        // and add to the latest WETH balance of this strategy.
        balance =
            lastVerifiedEthBalance +
            IWETH9(WETH).balanceOf(address(this));
    }

    function pause() external onlyStrategist {
        _pause();
    }

    /// @notice Returns bool indicating whether asset is supported by strategy.
    /// @param _asset The address of the asset token.
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == WETH;
    }

    /// @notice Approves the SSV Network contract to transfer SSV tokens for deposits
    function safeApproveAllTokens() external override {
        // Approves the SSV Network contract to transfer SSV tokens for deposits
        IERC20(SSV_TOKEN).approve(SSV_NETWORK, type(uint256).max);
    }

    /**
     * @notice We can accept ETH directly to this contract from anyone as it does not impact our accounting
     * like it did in the legacy NativeStakingStrategy.
     */
    receive() external payable {}

    /***************************************
                Internal functions
    ****************************************/

    function _abstractSetPToken(address _asset, address) internal override {}

    /// @dev Consensus rewards are compounded to the validator's balance instread of being
    /// swept to this strategy contract.
    /// Execution rewards from MEV and tx priority accumulate as ETH in this strategy contract,
    /// but so does withdrawals from validators. It's too complex to separate the two
    /// so this function is not implemented.
    /// Besides, ETH rewards are not sent to the Dripper any more. The Vault can regulate
    /// the increase in assets.
    function _collectRewardTokens() internal pure override {
        revert("Unsupported function");
    }
}
