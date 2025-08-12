// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";
import { CompoundingValidatorManager } from "./CompoundingValidatorManager.sol";

/// @title Compounding Staking SSV Strategy
/// @notice Strategy to deploy funds into DVT validators powered by the SSV Network
/// @author Origin Protocol Inc
contract CompoundingStakingSSVStrategy is
    CompoundingValidatorManager,
    InitializableAbstractStrategy
{
    /// @notice SSV ERC20 token that serves as a payment for operating SSV validators
    address public immutable SSV_TOKEN;

    // For future use
    uint256[50] private __gap;

    /// @param _baseConfig Base strategy config with
    ///   `platformAddress` not used so empty address
    ///   `vaultAddress` the address of the OETH Vault contract
    /// @param _wethAddress Address of the WETH Token contract
    /// @param _ssvToken Address of the SSV Token contract
    /// @param _ssvNetwork Address of the SSV Network contract
    /// @param _beaconChainDepositContract Address of the beacon chain deposit contract
    /// @param _beaconProofs Address of the Beacon Proofs contract that verifies beacon chain data
    /// @param _beaconGenesisTimestamp The timestamp of the Beacon chain's genesis.
    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _wethAddress,
        address _ssvToken,
        address _ssvNetwork,
        address _beaconChainDepositContract,
        address _beaconProofs,
        uint64 _beaconGenesisTimestamp
    )
        InitializableAbstractStrategy(_baseConfig)
        CompoundingValidatorManager(
            _wethAddress,
            _baseConfig.vaultAddress,
            _beaconChainDepositContract,
            _ssvNetwork,
            _beaconProofs,
            _beaconGenesisTimestamp
        )
    {
        SSV_TOKEN = _ssvToken;
    }

    /// @notice Set up initial internal state including
    /// 1. approving the SSVNetwork to transfer SSV tokens from this strategy contract
    /// @param _rewardTokenAddresses Not used so empty array
    /// @param _assets Not used so empty array
    /// @param _pTokens Not used so empty array
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

        safeApproveAllTokens();
    }

    /// @notice Unlike other strategies, this does not deposit assets into the underlying platform.
    /// It just checks the asset is WETH and emits the Deposit event.
    /// To deposit WETH into validators, `registerSsvValidator` and `stakeEth` must be used.
    /// @param _asset Address of the WETH token.
    /// @param _amount Amount of WETH that was transferred to the strategy by the vault.
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
    /// @param _recipient Address to receive withdrawn assets.
    /// @param _asset Address of the WETH token.
    /// @param _amount Amount of WETH to withdraw.
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_asset == WETH, "Unsupported asset");

        _withdraw(_recipient, _amount, address(this).balance);
    }

    function _withdraw(
        address _recipient,
        uint256 _withdrawAmount,
        uint256 _ethBalance
    ) internal {
        require(_withdrawAmount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");

        // Convert any ETH from validator partial withdrawals, exits
        // or execution rewards to WETH and do the necessary accounting.
        if (_ethBalance > 0) _convertEthToWeth(_ethBalance);

        // Transfer WETH to the recipient and do the necessary accounting.
        _transferWeth(_withdrawAmount, _recipient);

        emit Withdrawal(WETH, address(0), _withdrawAmount);
    }

    /// @notice Transfer all WETH deposits, ETH from validator withdrawals and ETH from
    /// execution rewards in this strategy to the vault.
    /// This does not withdraw from the validators. That has to be done separately with the
    /// `validatorWithdrawal` operation.
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 ethBalance = address(this).balance;
        uint256 withdrawAmount = IERC20(WETH).balanceOf(address(this)) +
            ethBalance;

        if (withdrawAmount > 0) {
            _withdraw(vaultAddress, withdrawAmount, ethBalance);
        }
    }

    /// @notice Accounts for all the assets managed by this strategy which includes:
    /// 1. The current WETH in this strategy contract
    /// 2. The last verified ETH balance, total deposits and total validator balances
    /// @param _asset      Address of WETH asset.
    /// @return balance    Total value in ETH
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

    /// @notice Returns bool indicating whether asset is supported by the strategy.
    /// @param _asset The address of the WETH token.
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == WETH;
    }

    /// @notice Approves the SSV Network contract to transfer SSV tokens for validator registration.
    function safeApproveAllTokens() public override {
        // Approves the SSV Network contract to transfer SSV tokens when validators are registered
        IERC20(SSV_TOKEN).approve(SSV_NETWORK, type(uint256).max);
    }

    /**
     * @notice We can accept ETH directly to this contract from anyone as it does not impact our accounting
     * like it did in the legacy NativeStakingStrategy.
     * The new ETH will be accounted for in `checkBalance` after the next snapBalances and verifyBalances txs.
     */
    receive() external payable {}

    /***************************************
                Internal functions
    ****************************************/

    /// @notice is not supported for this strategy as there is no platform token.
    function setPTokenAddress(address, address) external pure override {
        revert("Unsupported function");
    }

    /// @notice is not supported for this strategy as there is no platform token.
    function removePToken(uint256) external pure override {
        revert("Unsupported function");
    }

    /// @dev This strategy does not use a platform token like the old Aave and Compound strategies.
    function _abstractSetPToken(address _asset, address) internal override {}

    /// @dev Consensus rewards are compounded to the validator's balance instead of being
    /// swept to this strategy contract.
    /// Execution rewards from MEV and tx priority accumulate as ETH in this strategy contract.
    /// Withdrawals from validators also accumulate as ETH in this strategy contract.
    /// It's too complex to separate the rewards from withdrawals so this function is not implemented.
    /// Besides, ETH rewards are not sent to the Dripper any more. The Vault can now regulate
    /// the increase in assets.
    function _collectRewardTokens() internal pure override {
        revert("Unsupported function");
    }
}
