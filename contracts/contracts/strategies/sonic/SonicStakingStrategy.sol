// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SonicValidatorDelegator } from "./SonicValidatorDelegator.sol";
import { IWrappedSonic } from "../../interfaces/sonic/IWrappedSonic.sol";

/**
 * @title Staking Strategy for Sonic's native S currency
 * @author Origin Protocol Inc
 */
contract SonicStakingStrategy is SonicValidatorDelegator {
    // For future use
    uint256[50] private __gap;

    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _wrappedSonic,
        address _sfc
    ) SonicValidatorDelegator(_baseConfig, _wrappedSonic, _sfc) {}

    /// @notice Deposit wrapped S asset into the underlying platform.
    /// @param _asset Address of asset to deposit. Has to be Wrapped Sonic (wS).
    /// @param _amount Amount of assets that were transferred to the strategy by the vault.
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        require(_asset == wrappedSonic, "Unsupported asset");
        _deposit(_asset, _amount);
    }

    /**
     * @notice Deposit Wrapped Sonic (wS) to this strategy and delegate to a validator.
     * @param _asset Address of Wrapped Sonic (wS) token
     * @param _amount Amount of Wrapped Sonic (wS) to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal virtual {
        require(_amount > 0, "Must deposit something");

        _delegate(_amount);
        emit Deposit(_asset, address(0), _amount);
    }

    /**
     * @notice Deposit the entire balance of wrapped S in this strategy contract into
     * the underlying platform.
     */
    function depositAll() external virtual override onlyVault nonReentrant {
        uint256 wSBalance = IERC20(wrappedSonic).balanceOf(address(this));

        if (wSBalance > 0) {
            _deposit(wrappedSonic, wSBalance);
        }
    }

    /// @notice Withdraw Wrapped Sonic (wS) from this strategy contract.
    /// Used only if some wS is lingering on the contract.
    /// That can happen only when someone sends wS directly to this contract
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
    ) internal override {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");

        // slither-disable-next-line unchecked-transfer unused-return
        IERC20(_asset).transfer(_recipient, _amount);

        emit Withdrawal(wrappedSonic, address(0), _amount);
    }

    /// @notice Transfer all Wrapped Sonic (wS) deposits back to the vault.
    /// This does not withdraw from delegated validators. That has to be done separately with `undelegate`.
    /// Any native S in this strategy will be withdrawn.
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            IWrappedSonic(wrappedSonic).deposit{ value: balance }();
        }
        uint256 wSBalance = IERC20(wrappedSonic).balanceOf(address(this));
        if (wSBalance > 0) {
            _withdraw(vaultAddress, wrappedSonic, wSBalance);
        }
    }

    /**
     * @dev Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset token
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

    /// @notice is not used by this strategy as all staking rewards are restaked
    function collectRewardTokens() external override nonReentrant {
        revert("unsupported function");
    }

    /**
     * @notice is not supported for this strategy as the
     * Wrapped Sonic (wS) token is set at deploy time.
     */
    function removePToken(uint256) external view override onlyGovernor {
        revert("unsupported function");
    }

    /// @dev is not used by this strategy but must be implemented as it's abstract
    /// in the inherited `InitializableAbstractStrategy` contract.
    function _abstractSetPToken(address, address) internal virtual override {}

    /// @notice is not used by this strategy
    function safeApproveAllTokens() external override onlyGovernor {}
}
