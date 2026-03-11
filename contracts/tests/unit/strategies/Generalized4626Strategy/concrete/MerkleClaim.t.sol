// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_Generalized4626Strategy_Shared_Test
} from "tests/unit/strategies/Generalized4626Strategy/shared/Shared.t.sol";
import {Generalized4626Strategy} from "contracts/strategies/Generalized4626Strategy.sol";
import {IDistributor} from "contracts/interfaces/IMerkl.sol";

contract Unit_Concrete_Generalized4626Strategy_MerkleClaim_Test is Unit_Generalized4626Strategy_Shared_Test {
    function test_merkleClaim_callsDistributor() public {
        // Etch code at the Merkle Distributor address
        vm.etch(MERKLE_DISTRIBUTOR, hex"00");

        address token = address(asset);
        uint256 amount = 100e18;
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = bytes32(uint256(1));

        // Build expected call arguments
        address[] memory users = new address[](1);
        users[0] = address(strategy);
        address[] memory tokens = new address[](1);
        tokens[0] = token;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        bytes32[][] memory proofs = new bytes32[][](1);
        proofs[0] = proof;

        // Mock the claim call
        vm.mockCall(
            MERKLE_DISTRIBUTOR,
            abi.encodeWithSelector(IDistributor.claim.selector, users, tokens, amounts, proofs),
            abi.encode()
        );

        // Expect the call to be made
        vm.expectCall(
            MERKLE_DISTRIBUTOR, abi.encodeWithSelector(IDistributor.claim.selector, users, tokens, amounts, proofs)
        );

        strategy.merkleClaim(token, amount, proof);
    }

    function test_merkleClaim_emitsClaimedRewards() public {
        vm.etch(MERKLE_DISTRIBUTOR, hex"00");

        address token = address(asset);
        uint256 amount = 100e18;
        bytes32[] memory proof = new bytes32[](0);

        // Mock the claim call
        vm.mockCall(MERKLE_DISTRIBUTOR, abi.encodeWithSelector(IDistributor.claim.selector), abi.encode());

        vm.expectEmit(true, true, true, true);
        emit Generalized4626Strategy.ClaimedRewards(token, amount);

        strategy.merkleClaim(token, amount, proof);
    }

    function test_merkleClaim_anyoneCanCall() public {
        vm.etch(MERKLE_DISTRIBUTOR, hex"00");

        address token = address(asset);
        uint256 amount = 50e18;
        bytes32[] memory proof = new bytes32[](0);

        vm.mockCall(MERKLE_DISTRIBUTOR, abi.encodeWithSelector(IDistributor.claim.selector), abi.encode());

        // Anyone can call merkleClaim
        vm.prank(alice);
        strategy.merkleClaim(token, amount, proof);
    }
}
