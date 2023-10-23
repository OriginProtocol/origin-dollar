// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { BaseBuyback } from "./BaseBuyback.sol";

contract OETHBuyback is BaseBuyback {
    // abi.encodePacked(oeth, uint24(500), weth9, uint24(3000), ogv);
    bytes public constant ogvPath =
        hex"856c4efb76c1d1ae02e20ceb03a2a6a08b0b8dc30001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000bb89c354503c38481a7a7a51629142963f98ecc12d0";

    // abi.encodePacked(oeth, uint24(500), weth9, uint24(10000), cvx);
    bytes public constant cvxPath =
        hex"856c4efb76c1d1ae02e20ceb03a2a6a08b0b8dc30001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20027104e3fbd56cd56c3e72c1403e103b45db9da5b9d2b";

    constructor(
        address _oToken,
        address _ogv,
        address _cvx,
        address _cvxLocker
    ) BaseBuyback(_oToken, _ogv, _cvx, _cvxLocker) {}

    function _getSwapPath(address toToken)
        internal
        view
        override
        returns (bytes memory path)
    {
        if (toToken == ogv) {
            path = ogvPath;
        } else if (toToken == cvx) {
            path = cvxPath;
        } else {
            require(false, "Invalid toToken");
        }
    }
}
