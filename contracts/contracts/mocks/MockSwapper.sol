// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IMintableERC20 } from "./MintableERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockSwapper {
    uint256 public nextOutAmount;

    function swap(
        // solhint-disable-next-line no-unused-vars
        address _fromAsset,
        address _toAsset,
        // solhint-disable-next-line no-unused-vars
        uint256 _fromAssetAmount,
        uint256 _minToAssetAmount,
        // solhint-disable-next-line no-unused-vars
        bytes calldata _data
    ) external returns (uint256 toAssetAmount) {
        toAssetAmount = (nextOutAmount > 0) ? nextOutAmount : _minToAssetAmount;
        nextOutAmount = 0;
        IMintableERC20(_toAsset).mint(toAssetAmount);
        IERC20(_toAsset).transfer(msg.sender, toAssetAmount);
    }

    function setNextOutAmount(uint256 _nextOutAmount) public {
        nextOutAmount = _nextOutAmount;
    }
}
