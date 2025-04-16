// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import { MintBurnOFTAdapter } from "@layerzerolabs/oft-evm/contracts/MintBurnOFTAdapter.sol";
import { IMintableBurnable } from "@layerzerolabs/oft-evm/contracts/interfaces/IMintableBurnable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// NOTE: It's necessary to inherit from Ownable instead of Governable
///       because OFTCore uses Ownable to manage the governor.
///       Ownable uses slot 0 for storing the address, whereas Goveranble
///       stores it in a computed slot.

/// @notice Omnichain uses a deployed ERC-20 token and safeERC20
///         to interact with the OFTCore contract.
///         On L2, we follow the mint and burn mechanism.
///         The adapter should have minter and burner roles.

/// @title Omnichain L2 Adapter
contract OmnichainL2Adapter is MintBurnOFTAdapter {
    constructor(
        address _token,
        address _lzEndpoint,
        address _governor
    )
        MintBurnOFTAdapter(
            _token,
            IMintableBurnable(_token),
            _lzEndpoint,
            _governor
        )
        Ownable()
    {
        _transferOwnership(_governor);
    }
}
