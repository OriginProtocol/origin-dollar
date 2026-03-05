// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "../utils/InitializableAbstractStrategy.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { IVaultV2 } from "../interfaces/morpho/IVaultV2.sol";
import { IMorphoV2Adapter } from "../interfaces/morpho/IMorphoV2Adapter.sol";

library MorphoV2VaultUtils {
    error IncompatibleAdapter(address adapter);

    /**
     * @notice Return maximum amount that can be safely withdrawn from a Morpho V2 vault.
     * @dev Available liquidity is:
     *      1) asset balance parked on Morpho V2 vault contract
     *      2) additional liquidity from the active adapter if it resolves to a Morpho V1 vault
     *         and, when provided, matches the expected adapter
     */
    function maxWithdrawableAssets(
        address platformAddress,
        address assetToken
    ) internal view returns (uint256 availableAssetLiquidity) {
        availableAssetLiquidity = IERC20(assetToken).balanceOf(platformAddress);

        address liquidityAdapter = IVaultV2(platformAddress).liquidityAdapter();
        // this is a sufficient check to ensure the adapter is Morpho V1
        try IMorphoV2Adapter(liquidityAdapter).morphoVaultV1() returns (
            address underlyingVault
        ) {
            availableAssetLiquidity += IERC4626(underlyingVault).maxWithdraw(
                liquidityAdapter
            );
        } catch {
            revert IncompatibleAdapter(liquidityAdapter);
        }
    }

}
