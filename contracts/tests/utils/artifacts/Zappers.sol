// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library Zappers {
    string internal constant OETH_BASE_ZAPPER = "contracts/zapper/OETHBaseZapper.sol:OETHBaseZapper";
    string internal constant OETH_ZAPPER = "contracts/zapper/OETHZapper.sol:OETHZapper";
    string internal constant OS_ZAPPER = "contracts/zapper/OSonicZapper.sol:OSonicZapper";
    string internal constant WOETH_CCIP_ZAPPER = "contracts/zapper/WOETHCCIPZapper.sol:WOETHCCIPZapper";
}
