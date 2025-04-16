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

    /// @inheritdoc MintBurnOFTAdapter
    function _debit(
        address _from,
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    )
        internal
        virtual
        override
        returns (uint256 amountSentLD, uint256 amountReceivedLD)
    {
        (amountSentLD, amountReceivedLD) = _debitView(
            _amountLD,
            _minAmountLD,
            _dstEid
        );
        // Burns tokens from the caller.
        IMintableERC20(address(minterBurner)).burn(_from, amountSentLD);
    }

    /// @inheritdoc MintBurnOFTAdapter
    function _credit(
        address _to,
        uint256 _amountLD,
        uint32 /* _srcEid */
    ) internal virtual override returns (uint256 amountReceivedLD) {
        if (_to == address(0x0)) _to = address(0xdead); // _mint(...) does not support address(0x0)
        // Mints the tokens and transfers to the recipient.
        IMintableERC20(address(minterBurner)).mint(_to, _amountLD);
        // In the case of NON-default OFTAdapter, the amountLD MIGHT not be equal to amountReceivedLD.
        return _amountLD;
    }
}

interface IMintableERC20 {
    function mint(address to, uint256 value) external;

    function burn(address to, uint256 value) external;
}
