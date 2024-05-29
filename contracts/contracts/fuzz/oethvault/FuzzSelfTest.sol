// SPDX-License-Identifier: MIT
import {FuzzOETH} from "./FuzzOETH.sol";
import {FuzzVault} from "./FuzzVault.sol";
import {FuzzGlobal} from "./FuzzGlobal.sol";

import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title Contract containing self tests for the Fuzzing campaign
 * @author Rappie <rappie@perimetersec.io>
 * @dev This contract is used to test the Fuzzing campaign itself. It is
 * used to test all fuzz tests for unwanted reverts. It is for debugging
 * only and can be disabled in production.
 */
contract FuzzSelfTest is FuzzVault {
    function selfTestRedeemClamped(uint256 amount) public {
        bytes memory callData = abi.encodeWithSelector(
            FuzzVault.redeemClamped.selector,
            amount
        );
        _testSelf(callData, "SELF-07: Redeem failed");
    }

    function selfTestMintClamped(uint256 amount) public {
        bytes memory callData = abi.encodeWithSelector(
            FuzzVault.mintClamped.selector,
            amount
        );
        _testSelf(callData, "SELF-08: Mint failed");
    }

    function selfTestTransfer(uint8 toActorIndex, uint256 amount) public {
        bytes memory callData = abi.encodeWithSelector(
            FuzzOETH.transfer.selector,
            toActorIndex,
            amount
        );
        _testSelf(callData, "SELF-09: Transfer failed");
    }

    function selfTestOptIn() public {
        bytes memory callData = abi.encodeWithSelector(FuzzOETH.optIn.selector);
        _testSelf(callData, "SELF-10: OptIn failed");
    }

    function selfTestOptOut() public {
        bytes memory callData = abi.encodeWithSelector(
            FuzzOETH.optOut.selector
        );
        _testSelf(callData, "SELF-11: OptOut failed");
    }

    function selfTestRedeemAll() public {
        bytes memory callData = abi.encodeWithSelector(
            FuzzVault.redeemAll.selector
        );
        _testSelf(callData, "SELF-12: RedeemAll failed");
    }

    function selfTestDonateAndRebase(uint256 amount) public {
        bytes memory callData = abi.encodeWithSelector(
            FuzzVault.donateAndRebase.selector,
            amount
        );
        _testSelf(callData, "SELF-13: DonateAndRebase failed");
    }

    function selfTestGlobalInvariants() public {
        bytes memory callData = abi.encodeWithSelector(
            FuzzGlobal.globalInvariants.selector
        );
        _testSelf(callData, "SELF-14: GlobalInvariants failed");
    }

    function _testSelf(bytes memory callData, string memory message) internal {
        (bool success, bytes memory returnData) = address(this).delegatecall(
            callData
        );

        bytes4 errorSelector = bytes4(returnData);
        if (!(errorSelector == FuzzRequireError.selector)) {
            t(success, message);
        }
    }

    function selfTestActorUserVsContract() public {
        t(
            !Address.isContract(ADDRESS_OUTSIDER_NONREBASING),
            "SELF-01: Deployer should not be a contract"
        );
        t(
            !Address.isContract(ADDRESS_OUTSIDER_REBASING),
            "SELF-02: Deployer should not be a contract"
        );
        t(
            !Address.isContract(ADDRESS_ACTOR1),
            "SELF-03: Actor 1 should not be a contract"
        );
        t(
            !Address.isContract(ADDRESS_ACTOR2),
            "SELF-04: Actor 2 should not be a contract"
        );
        t(
            Address.isContract(ADDRESS_ACTOR3),
            "SELF-05: Actor 3 should be a contract"
        );
        t(
            Address.isContract(ADDRESS_ACTOR4),
            "SELF-06: Actor 4 should be a contract"
        );
    }
}
