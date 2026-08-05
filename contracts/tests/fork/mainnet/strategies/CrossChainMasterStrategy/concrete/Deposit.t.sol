// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Mainnet, CrossChain} from "tests/utils/Addresses.sol";

// --- External libraries
import {Vm} from "forge-std/Vm.sol";

contract Fork_CrossChainMasterStrategy_Deposit_Test is Fork_CrossChainMasterStrategy_Shared_Test {
    // DepositForBurn(address indexed burnToken, uint256 amount, address indexed depositor, ...)
    event DepositForBurn(
        address indexed burnToken,
        uint256 amount,
        address indexed depositer,
        uint256 indexed minFinalityThreshold,
        address mintRecipient,
        uint32 destinationDomain,
        address destinationTokenMessenger,
        address destinationCaller,
        uint256 maxFee,
        bytes hookData
    );

    function test_deposit_bridgesUsdc() public {
        _skipIfTransferPending();

        // Transfer USDC to strategy
        vm.prank(matt);
        usdc.transfer(address(crossChainMasterStrategy), 1000e6);

        uint256 usdcBalanceBefore = usdc.balanceOf(address(crossChainMasterStrategy));
        uint256 checkBalanceBefore = crossChainMasterStrategy.checkBalance(Mainnet.USDC);

        // Deposit as vault
        vm.recordLogs();
        vm.prank(vaultAddr);
        crossChainMasterStrategy.deposit(Mainnet.USDC, 1000e6);

        // Assert USDC balance decreased
        uint256 usdcBalanceAfter = usdc.balanceOf(address(crossChainMasterStrategy));
        assertEq(usdcBalanceAfter, usdcBalanceBefore - 1000e6, "USDC balance should decrease by 1000");

        // Assert checkBalance unchanged (pendingAmount compensates)
        uint256 checkBalanceAfter = crossChainMasterStrategy.checkBalance(Mainnet.USDC);
        assertEq(checkBalanceAfter, checkBalanceBefore, "checkBalance should be unchanged");

        // Assert pendingAmount
        assertEq(crossChainMasterStrategy.pendingAmount(), 1000e6, "pendingAmount should be 1000 USDC");

        // Verify DepositForBurn event
        Vm.Log[] memory entries = vm.getRecordedLogs();
        bytes32 depositForBurnTopic = 0x0c8c1cbdc5190613ebd485511d4e2812cfa45eecb79d845893331fedad5130a5;

        bool found = false;
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics[0] == depositForBurnTopic) {
                found = true;

                // Decode indexed topics
                address burnToken = address(uint160(uint256(entries[i].topics[1])));
                assertEq(burnToken, Mainnet.USDC, "burnToken should be USDC");

                // Decode data
                (
                    uint256 amount,
                    address mintRecipient,
                    uint32 destinationDomain,
                    address destinationTokenMessenger,
                    address destinationCaller,
                    uint256 maxFee,
                    bytes memory hookData
                ) = abi.decode(entries[i].data, (uint256, address, uint32, address, address, uint256, bytes));

                assertEq(amount, 1000e6, "amount should be 1000 USDC");
                assertEq(destinationDomain, 6, "destinationDomain should be Base (6)");
                assertEq(maxFee, 0, "maxFee should be 0");
                assertEq(mintRecipient, address(crossChainMasterStrategy), "mintRecipient should be strategy");
                assertEq(
                    destinationTokenMessenger, CrossChain.CCTPTokenMessengerV2, "destinationTokenMessenger should match"
                );
                assertEq(destinationCaller, address(crossChainMasterStrategy), "destinationCaller should be strategy");

                // Decode hookData to verify message type and amount
                uint32 originVersion = uint32(bytes4(hookData));
                uint32 messageType =
                    uint32(bytes4(bytes(abi.encodePacked(hookData[4], hookData[5], hookData[6], hookData[7]))));
                assertEq(originVersion, 1010, "Origin message version should be 1010");
                assertEq(messageType, 1, "messageType should be DEPOSIT (1)");

                break;
            }
        }
        assertTrue(found, "DepositForBurn event not found");
    }

    /// @dev deposit() reverts when a transfer is already pending (pendingAmount != 0)
    function test_revert_deposit_whileTransferPending() public {
        _skipIfTransferPending();

        // First deposit to create pending state
        vm.prank(matt);
        usdc.transfer(address(crossChainMasterStrategy), 2000e6);

        vm.prank(vaultAddr);
        crossChainMasterStrategy.deposit(Mainnet.USDC, 1000e6);

        assertTrue(crossChainMasterStrategy.isTransferPending(), "Should have pending transfer");

        // Second deposit should fail — hits "Unexpected pending amount" first
        // because pendingAmount != 0 check comes before the nonce check
        vm.prank(vaultAddr);
        vm.expectRevert("Unexpected pending amount");
        crossChainMasterStrategy.deposit(Mainnet.USDC, 1000e6);
    }
}
