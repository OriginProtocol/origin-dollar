// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Generalized 4626 Strategy when asset is Tether USD (USDT)
 * @notice Investment strategy for ERC-4626 Tokenized Vaults for the USDT asset.
 * @author Origin Protocol Inc
 */
import { Generalized4626Strategy } from "./Generalized4626Strategy.sol";
import { IVaultV2 } from "../interfaces/morpho/IVaultV2.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { IMorphoV2Adapter } from "../interfaces/morpho/IMorphoV2Adapter.sol";
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
     * @dev Remove all the liquidity that is available in the Morpho V2 vault
     *      The particular behaviour of the Morpho V2 vault is that it can hold 
     *      multiple Morpho V1 vaults as adapters but only one liquidity adapter.
     *      The immediate available funds on the Morpho V2 vault are therfore any 
     *      any liquid assets residing on the Vault V2 contract and the maxWithdraw
     *      amount that the Morpho V1 contract can supply.
     *
     */
    function withdrawAll()
        external
        virtual
        override
        onlyVaultOrGovernor
        nonReentrant
    {
        uint256 availableMorphoVault = _maxWithdraw();

        uint256 strategyAssetBalance = checkBalance(address(assetToken));
        uint256 balanceToWithdraw = Math.min(availableMorphoVault, strategyAssetBalance);
        
        if (balanceToWithdraw > 0) {
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

    function _maxWithdraw() internal view returns (uint256 availableAssetLiquidity) {
        availableAssetLiquidity = assetToken.balanceOf(platformAddress);

        address liquidityAdapter = IVaultV2(platformAddress).liquidityAdapter();
        if (liquidityAdapter != address(0)) {
            // adapter representing one Morpho V1 vault
            address underlyingVault = IMorphoV2Adapter(liquidityAdapter).morphoVaultV1();
            availableAssetLiquidity += IERC4626(underlyingVault).maxWithdraw(liquidityAdapter);
        }
    }

    
}
