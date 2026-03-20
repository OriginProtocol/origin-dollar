// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import { OFTAdapter } from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// NOTE: It's necessary to inherit from Ownable instead of Governable
///       because OFTCore uses Ownable to manage the governor.
///       Ownable uses slot 0 for storing the address, whereas Goveranble
///       stores it in a computed slot.

/// @notice Omnichain uses a deployed ERC-20 token and safeERC20
///         to interact with the OFTCore contract.
///         On Ethereum, we follow the lock and unlock mechanism.

/// @title Omnichain Mainnet Adapter
contract OmnichainMainnetAdapter is OFTAdapter {
    constructor(
        address _token,
        address _lzEndpoint,
        address _governor
    ) OFTAdapter(_token, _lzEndpoint, _governor) Ownable() {
        _transferOwnership(_governor);
    }
}
