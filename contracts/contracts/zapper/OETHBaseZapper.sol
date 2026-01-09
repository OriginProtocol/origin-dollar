// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractOTokenZapper } from "./AbstractOTokenZapper.sol";

contract OETHBaseZapper is AbstractOTokenZapper {
    constructor(
        address _oethb,
        address _woethb,
        address _vault
    )
        AbstractOTokenZapper(
            _oethb,
            _woethb,
            _vault,
            0x4200000000000000000000000000000000000006
        )
    {}
}
