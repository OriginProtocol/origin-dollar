// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { SonicValidatorDelegator } from "./SonicValidatorDelegator.sol";

/**
 * @title Staking Strategy for Sonic's native S currency
 * @author Origin Protocol Inc
 */
contract SonicStakingStrategy is SonicValidatorDelegator {
    /// @dev This contract receives Wrapped S (wS) as the deposit asset, but unlike other strategies doesn't immediately
    /// deposit it to an underlying platform. Rather a special privilege account stakes it to the validators.
    /// For that reason calling wrappedSonic.balanceOf(this) in a deposit function can contain wS that has just been
    /// deposited and also wS that has previously been deposited. To keep a correct count we need to keep track
    /// of wS that has already been accounted for.
    /// This value represents the amount of wS balance of this contract that has already been accounted for by the
    /// deposit events.
    uint256 public depositedWSAccountedFor;

    // For future use
    uint256[49] private __gap;

    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _wrappedSonic,
        address _sfc
    ) SonicValidatorDelegator(_baseConfig, _wrappedSonic, _sfc) {}

    /// @notice Unlike other strategies, this does not deposit assets into the underlying platform.
    /// It just checks the asset is Wrapped Sonic (wS) and emits the Deposit event.
    /// To deposit wS into validators `delegate` must be used.
    /// @param _asset Address of asset to deposit. Has to be Wrapped Sonic (wS).
    /// @param _amount Amount of assets that were transferred to the strategy by the vault.
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        require(_asset == wrappedSonic, "Unsupported asset");
        depositedWSAccountedFor += _amount;
        _deposit(_asset, _amount);
    }

    /**
     * @notice Deposit Wrapped Sonic (wS) to this strategy so it can later be delegated to a validator.
     * @param _asset Address of Wrapped Sonic (wS) token
     * @param _amount Amount of Wrapped Sonic (wS) to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal virtual {
        require(_amount > 0, "Must deposit something");

        emit Deposit(_asset, address(0), _amount);
    }

    /**
     * @notice Deposit the entire balance of wrapped S in this strategy contract
     */

    /// @notice Unlike other strategies, this does not deposit assets into the underlying platform.
    /// It just emits the Deposit event.
    /// To deposit WETH into validators `registerSsvValidator` and `stakeEth` must be used.
    /// Will NOT revert if the strategy is paused from an accounting failure.
    function depositAll() external virtual override onlyVault nonReentrant {
        uint256 wSBalance = IERC20(wrappedSonic).balanceOf(address(this));
        uint256 newWS = wSBalance - depositedWSAccountedFor;

        if (newWS > 0) {
            depositedWSAccountedFor = wSBalance;

            _deposit(wrappedSonic, newWS);
        }
    }

    /// @notice Withdraw Wrapped Sonic (wS) from this strategy contract.
    /// Used only if some wS is lingering on the contract.
    /// That can happen when:
    ///   - after mints if the strategy is the default
    ///   - time between depositToStrategy and delegate
    ///   - someone sent wS directly to this contract
    /// @param _recipient Address to receive withdrawn assets
    /// @param _asset Address of the Wrapped Sonic (wS) token
    /// @param _amount Amount of Wrapped Sonic (wS) to withdraw
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_asset == wrappedSonic, "Unsupported asset");
        _withdraw(_recipient, _asset, _amount);
    }

    function _withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) internal {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");

        emit Withdrawal(wrappedSonic, address(0), _amount);

        IERC20(_asset).transfer(_recipient, _amount);
        emit Withdrawal(_asset, address(0), _amount);
    }

    /// @notice transfer all Wrapped Sonic (wS) deposits back to the vault.
    /// This does not withdraw from delegated validators. That has to be done separately with `undelegate`.
    /// Any native S in this strategy will not be withdrawn.
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 wSBalance = IERC20(wrappedSonic).balanceOf(address(this));
        if (wSBalance > 0) {
            _withdraw(vaultAddress, wrappedSonic, wSBalance);
        }
    }

    /// @notice Returns the total value of Sonic (S) that is delegated validators.
    /// Wrapped Sonic (wS) deposits that are still to be delegated and any undelegated amounts
    /// still pending a withdrawal.
    /// @param _asset      Address of Wrapped Sonic (wS) token
    /// @return balance    Total value managed by the strategy
    function checkBalance(address _asset)
        external
        view
        virtual
        override
        returns (uint256 balance)
    {
        require(_asset == wrappedSonic, "Unsupported asset");

        balance =
            totalDelegated +
            pendingWithdrawals +
            // add the Wrapped Sonic (wS) in the strategy from deposits that are still to be delegated
            IERC20(wrappedSonic).balanceOf(address(this));
    }

    /**
     * @dev Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset)
        public
        view
        virtual
        override
        returns (bool)
    {
        return _asset == wrappedSonic;
    }

    /**
     * @notice is not supported for this strategy as the
     * Wrapped Sonic (wS) token is set at deploy time.
     */
    function setPTokenAddress(address, address)
        external
        view
        override
        onlyGovernor
    {
        revert("unsupported function");
    }

    /**
     * @notice is not supported for this strategy as the
     * Wrapped Sonic (wS) token is set at deploy time.
     */
    function removePToken(uint256) external view override onlyGovernor {
        revert("unsupported function");
    }

    function _abstractSetPToken(address, address) internal virtual override {}

    function safeApproveAllTokens() external override onlyGovernor {}
}
