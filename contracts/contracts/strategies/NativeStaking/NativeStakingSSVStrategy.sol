// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";
import { FeeAccumulator } from "./FeeAccumulator.sol";
import { ValidatorRegistrator } from "./ValidatorRegistrator.sol";
import { ISSVNetwork } from "../../interfaces/ISSVNetwork.sol";

struct ValidatorStakeData {
    bytes pubkey;
    bytes signature;
    bytes32 depositDataRoot;
}

/// @title Native Staking SSV Strategy
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
contract NativeStakingSSVStrategy is
    ValidatorRegistrator,
    InitializableAbstractStrategy
{
    using SafeERC20 for IERC20;

    // Slots previously used by ValidatorAccountant
    uint256[54] private __gap;

    /// @notice SSV ERC20 token that serves as a payment for operating SSV validators
    address public immutable SSV_TOKEN;
    /// @notice Fee collector address
    /// @dev this address will receive maximal extractable value (MEV) rewards. These are
    /// rewards for arranging transactions in a way that benefits the validator.
    address payable public immutable FEE_ACCUMULATOR_ADDRESS;

    /// @dev This contract receives WETH as the deposit asset, but unlike other strategies doesn't immediately
    /// deposit it to an underlying platform. Rather a special privilege account stakes it to the validators.
    /// For that reason calling WETH.balanceOf(this) in a deposit function can contain WETH that has just been
    /// deposited and also WETH that has previously been deposited. To keep a correct count we need to keep track
    /// of WETH that has already been accounted for.
    /// This value represents the amount of WETH balance of this contract that has already been accounted for by the
    /// deposit events.
    /// It is important to note that this variable is not concerned with WETH that is a result of full/partial
    /// withdrawal of the validators. It is strictly concerned with WETH that has been deposited and is waiting to
    /// be staked.
    uint256 public depositedWethAccountedFor;

    // For future use
    uint256[49] private ___gap;

    /// @param _baseConfig Base strategy config with platformAddress (ERC-4626 Vault contract), eg sfrxETH or sDAI,
    /// and vaultAddress (OToken Vault contract), eg VaultProxy or OETHVaultProxy
    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _ssvToken Address of the Erc20 SSV Token contract
    /// @param _ssvNetwork Address of the SSV Network contract
    /// @param _maxValidators Maximum number of validators that can be registered in the strategy
    /// @param _feeAccumulator Address of the fee accumulator receiving execution layer validator rewards
    /// @param _beaconChainDepositContract Address of the beacon chain deposit contract
    /// @param _beaconOracle Address of the Beacon Oracle contract that maps block numbers to slots
    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _wethAddress,
        address _ssvToken,
        address _ssvNetwork,
        uint256 _maxValidators,
        address _feeAccumulator,
        address _beaconChainDepositContract,
        address _beaconOracle
    )
        InitializableAbstractStrategy(_baseConfig)
        ValidatorRegistrator(
            _wethAddress,
            _baseConfig.vaultAddress,
            _beaconChainDepositContract,
            _ssvNetwork,
            _maxValidators,
            _beaconOracle
        )
    {
        SSV_TOKEN = _ssvToken;
        FEE_ACCUMULATOR_ADDRESS = payable(_feeAccumulator);
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

        // Set the FeeAccumulator as the address for SSV validators to send MEV rewards to
        ISSVNetwork(SSV_NETWORK).setFeeRecipientAddress(
            FEE_ACCUMULATOR_ADDRESS
        );
    }

    /// @notice Unlike other strategies, this does not deposit assets into the underlying platform.
    /// It just checks the asset is WETH and emits the Deposit event.
    /// To deposit WETH into validators `registerSsvValidator` and `stakeEth` must be used.
    /// Will NOT revert if the strategy is paused from an accounting failure.
    /// @param _asset Address of asset to deposit. Has to be WETH.
    /// @param _amount Amount of assets that were transferred to the strategy by the vault.
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        require(_asset == WETH, "Unsupported asset");
        depositedWethAccountedFor += _amount;
        _deposit(_asset, _amount);
    }

    /// @dev Deposit WETH to this strategy so it can later be staked into a validator.
    /// @param _asset Address of WETH
    /// @param _amount Amount of WETH to deposit
    function _deposit(address _asset, uint256 _amount) internal {
        require(_amount > 0, "Must deposit something");
        /*
         * We could do a check here that would revert when "_amount % 32 ether != 0". With the idea of
         * not allowing deposits that will result in WETH sitting on the strategy after all the possible batches
         * of 32ETH have been staked.
         * But someone could mess with our strategy by sending some WETH to it. And we might want to deposit just
         * enough WETH to add it up to 32 so it can be staked. For that reason the check is left out.
         *
         * WETH sitting on the strategy won't interfere with the accounting since accounting only operates on ETH.
         */
        emit Deposit(_asset, address(0), _amount);
    }

    /// @notice Unlike other strategies, this does not deposit assets into the underlying platform.
    /// It just emits the Deposit event.
    /// To deposit WETH into validators `registerSsvValidator` and `stakeEth` must be used.
    /// Will NOT revert if the strategy is paused from an accounting failure.
    function depositAll() external override onlyVault nonReentrant {
        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        uint256 newWeth = wethBalance - depositedWethAccountedFor;

        if (newWeth > 0) {
            depositedWethAccountedFor = wethBalance;

            _deposit(WETH, newWeth);
        }
    }

    /// @notice Withdraw WETH from this contract. Used only if some WETH for is lingering on the contract.
    /// That can happen when:
    ///   - after mints if the strategy is the default
    ///   - time between depositToStrategy and stakeEth
    ///   - the deposit was not a multiple of 32 WETH
    ///   - someone sent WETH directly to this contract
    /// Will NOT revert if the strategy is paused from an accounting failure.
    /// @param _recipient Address to receive withdrawn assets
    /// @param _asset WETH to withdraw
    /// @param _amount Amount of WETH to withdraw
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_asset == WETH, "Unsupported asset");
        _withdraw(_recipient, _asset, _amount);
    }

    function _withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) internal {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");

        _wethWithdrawn(_amount);

        IERC20(_asset).safeTransfer(_recipient, _amount);
        emit Withdrawal(_asset, address(0), _amount);
    }

    /// @notice transfer all WETH deposits back to the vault.
    /// This does not withdraw from the validators. That has to be done separately with the
    /// `exitSsvValidator` and `removeSsvValidator` operations.
    /// This does not withdraw any execution rewards from the FeeAccumulator or
    /// consensus rewards in this strategy.
    /// Any ETH in this strategy that was swept from a full validator withdrawal will not be withdrawn.
    /// ETH from full validator withdrawals is sent to the Vault using `doAccounting`.
    /// Will NOT revert if the strategy is paused from an accounting failure.
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        if (wethBalance > 0) {
            _withdraw(vaultAddress, WETH, wethBalance);
        }
    }

    /// @notice Returns the total value of (W)ETH that is staked to the validators
    /// and WETH deposits that are still to be staked.
    /// This does not include ETH from consensus rewards sitting in this strategy
    /// or ETH from MEV rewards in the FeeAccumulator. These rewards are harvested
    /// and sent to the Dripper so will eventually be sent to the Vault as WETH.
    /// @param _asset      Address of weth asset
    /// @return balance    Total value of (W)ETH
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        require(_asset == WETH, "Unsupported asset");

        // balance =
        //     // add the ETH that has been staked in validators
        //     activeDepositedValidators *
        //     FULL_STAKE +
        //     // add the WETH in the strategy from deposits that are still to be staked
        //     IERC20(WETH).balanceOf(address(this));

        // TODO need to handle the transition
        balance = lastProvenBalance;
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

    /// @notice Set the FeeAccumulator as the address for SSV validators to send MEV rewards to
    function setFeeRecipient() external {
        ISSVNetwork(SSV_NETWORK).setFeeRecipientAddress(
            FEE_ACCUMULATOR_ADDRESS
        );
    }

    /**
     * @notice Only accept ETH from the FeeAccumulator and the WETH contract - required when
     * unwrapping WETH just before staking it to the validator.
     * The strategy will also receive ETH from the priority fees of transactions when producing blocks
     * as defined in EIP-1559.
     * The tx fees come from the Beacon chain so do not need any EVM level permissions to receive ETH.
     * The tx fees are paid with each block produced. They are not included in the consensus rewards
     * which are periodically swept from the validators to this strategy.
     * For accounting purposes, the priority fees of transactions will be considered consensus rewards
     * and will be included in the AccountingConsensusRewards event.
     * @dev don't want to receive donations from anyone else as donations over the fuse limits will
     * mess with the accounting of the consensus rewards and validator full withdrawals.
     */
    receive() external payable {
        require(
            msg.sender == FEE_ACCUMULATOR_ADDRESS || msg.sender == WETH,
            "Eth not from allowed contracts"
        );
    }

    /***************************************
                Internal functions
    ****************************************/

    function _abstractSetPToken(address _asset, address) internal override {}

    /// @dev Convert accumulated ETH to WETH and send to the Harvester.
    /// Will revert if the strategy is paused for accounting.
    function _collectRewardTokens() internal override whenNotPaused {
        // collect ETH from execution rewards from the fee accumulator
        uint256 executionRewards = FeeAccumulator(FEE_ACCUMULATOR_ADDRESS)
            .collect();

        require(
            address(this).balance >= executionRewards,
            "Insufficient eth balance"
        );

        if (executionRewards > 0) {
            // Convert ETH rewards to WETH
            IWETH9(WETH).deposit{ value: executionRewards }();

            IERC20(WETH).safeTransfer(harvesterAddress, executionRewards);
            emit RewardTokenCollected(harvesterAddress, WETH, executionRewards);
        }
    }

    // /// @dev emits Withdrawal event from NativeStakingSSVStrategy
    // function _wethWithdrawnToVault(uint256 _amount) internal {
    //     emit Withdrawal(WETH, address(0), _amount);
    // }

    /// @dev Called when WETH is withdrawn from the strategy or staked to a validator so
    /// the strategy knows how much WETH it has on deposit.
    /// This is so it can emit the correct amount in the Deposit event in depositAll().
    function _wethWithdrawn(uint256 _amount) internal override {
        /* In an ideal world we wouldn't need to reduce the deduction amount when the
         * depositedWethAccountedFor is smaller than the _amount.
         *
         * The reason this is required is that a malicious actor could sent WETH directly
         * to this contract and that would circumvent the increase of depositedWethAccountedFor
         * property. When the ETH would be staked the depositedWethAccountedFor amount could
         * be deducted so much that it would be negative.
         */
        uint256 deductAmount = Math.min(_amount, depositedWethAccountedFor);
        depositedWethAccountedFor -= deductAmount;
    }
}
