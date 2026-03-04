// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Generalized 4626 Strategy when the underlying platform is Morpho V2
 * @notice Investment strategy for ERC-4626 Tokenized Vaults for the Morpho V2 platform.
 * @author Origin Protocol Inc
 */
import { Generalized4626Strategy } from "./Generalized4626Strategy.sol";
import { MorphoV2VaultUtils } from "./MorphoV2VaultUtils.sol";
import { IVaultV2 } from "../interfaces/morpho/IVaultV2.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

contract MorphoV2Strategy is Generalized4626Strategy {

    /**
     * @param _baseConfig Base strategy config with Morpho V2 Vault and
     * vaultAddress (OToken Vault contract), eg VaultProxy or OETHVaultProxy
     * @param _assetToken Address of the ERC-4626 asset token. e.g. USDC
     */
    constructor(BaseStrategyConfig memory _baseConfig, address _assetToken)
        Generalized4626Strategy(_baseConfig, _assetToken)
    {}

    /**
     * @notice Remove all the liquidity that is available in the Morpho V2 vault.
     *         Which might not be all of the liquidity owned by the strategy.
     * @dev Remove all the liquidity that is available in the Morpho V2 vault
     *      The particular behaviour of the Morpho V2 vault is that it can hold
     *      multiple Morpho V1 vaults as adapters but only one liquidity adapter.
     *      The immediate available funds on the Morpho V2 vault are therfore any
     *      liquid assets residing on the Vault V2 contract and the maxWithdraw
     *      amount that the Morpho V1 contract can supply.
     */
    function withdrawAll()
        external
        virtual
        override
        onlyVaultOrGovernor
        nonReentrant
    {
        uint256 availableMorphoVault = _maxWithdraw();
        uint256 balanceToWithdraw = Math.min(
            availableMorphoVault,
            checkBalance(address(assetToken))
        );

        if (balanceToWithdraw > 0) {
            // slither-disable-next-line unused-return
            IVaultV2(platformAddress).withdraw(
                balanceToWithdraw,
                vaultAddress,
                address(this)
            );
        }

        emit Withdrawal(
            address(assetToken),
            address(shareToken),
            balanceToWithdraw
        );
    }

    function maxWithdraw() external view returns (uint256) {
        return _maxWithdraw();
    }

    function _maxWithdraw()
        internal
        view
        returns (uint256 availableAssetLiquidity)
    {
        availableAssetLiquidity = MorphoV2VaultUtils.maxWithdrawableAssets(
            platformAddress,
            address(assetToken)
        );
    }
}
