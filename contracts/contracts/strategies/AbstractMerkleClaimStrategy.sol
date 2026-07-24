// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Abstract strategy with Merkl reward claiming
 * @notice Adds the ability to claim rewards from the Merkl Distributor to a strategy.
 * @dev Holds no storage so it is safe to insert into the inheritance chain of an
 *      already deployed upgradeable strategy without shifting any storage slots.
 * @author Origin Protocol Inc
 */
import { InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { IDistributor } from "../interfaces/IMerkl.sol";

abstract contract AbstractMerkleClaimStrategy is InitializableAbstractStrategy {
    /// @notice The address of the Merkle Distributor contract.
    IDistributor public constant merkleDistributor =
        IDistributor(0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae);

    event ClaimedRewards(address indexed token, uint256 amount);

    /**
     * @param _baseConfig The platform and OToken vault addresses
     */
    constructor(BaseStrategyConfig memory _baseConfig)
        InitializableAbstractStrategy(_baseConfig)
    {}

    /// @notice Claim tokens from the Merkle Distributor
    /// @param token The address of the token to claim.
    /// @param amount The amount of tokens to claim.
    /// @param proof The Merkle proof to validate the claim.
    function merkleClaim(
        address token,
        uint256 amount,
        bytes32[] calldata proof
    ) external {
        address[] memory users = new address[](1);
        users[0] = address(this);

        address[] memory tokens = new address[](1);
        tokens[0] = token;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        bytes32[][] memory proofs = new bytes32[][](1);
        proofs[0] = proof;

        merkleDistributor.claim(users, tokens, amounts, proofs);

        emit ClaimedRewards(token, amount);
    }
}
