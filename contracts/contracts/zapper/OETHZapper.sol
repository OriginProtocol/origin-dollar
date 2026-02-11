// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractOTokenZapper } from "./AbstractOTokenZapper.sol";

contract OETHZapper is AbstractOTokenZapper {
    constructor(
        address _oeth,
        address _woeth,
        address _vault,
        address _weth
    ) AbstractOTokenZapper(_oeth, _woeth, _vault, _weth) {}
}
