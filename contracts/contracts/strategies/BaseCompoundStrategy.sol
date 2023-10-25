// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Base Compound Abstract Strategy
 * @author Origin Protocol Inc
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ICERC20 } from "./ICompound.sol";
import { IComptroller } from "../interfaces/IComptroller.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";

abstract contract BaseCompoundStrategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;

    int256[50] private __reserved;

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return assetToPToken[_asset] != address(0);
    }

    /**
     * @dev Get the cToken wrapped in the ICERC20 interface for this asset.
     *      Fails if the pToken doesn't exist in our mappings.
     * @param _asset Address of the asset
     * @return Corresponding cToken to this asset
     */
    function _getCTokenFor(address _asset) internal view returns (ICERC20) {
        address cToken = assetToPToken[_asset];
        require(cToken != address(0), "cToken does not exist");
        return ICERC20(cToken);
    }

    /**
     * @dev Converts an underlying amount into cToken amount
     *      cTokenAmt = (underlying * 1e18) / exchangeRate
     * @param _cToken     cToken for which to change
     * @param _underlying Amount of underlying to convert
     * @return amount     Equivalent amount of cTokens
     */
    function _convertUnderlyingToCToken(ICERC20 _cToken, uint256 _underlying)
        internal
        view
        returns (uint256 amount)
    {
        // e.g. 1e18*1e18 / 205316390724364402565641705 = 50e8
        // e.g. 1e8*1e18 / 205316390724364402565641705 = 0.45 or 0
        amount = (_underlying * 1e18) / _cToken.exchangeRateStored();
    }
}
