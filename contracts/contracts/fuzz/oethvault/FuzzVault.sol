// SPDX-License-Identifier: MIT
import {FuzzHelper} from "./FuzzHelper.sol";

/**
 * @title Contract containing fuzz tests for Vault
 * @author Rappie <rappie@perimetersec.io>
 */
contract FuzzVault is FuzzHelper {
    /**
     * @notice Mint OETH without clamping
     * @param amount Amount of OETH to mint
     */
    function mint(uint256 amount) public setCurrentActor {
        vm.prank(currentActor);
        vault.mint(address(weth), amount, 0);
    }

    /**
     * @notice Mint OETH with clamping
     * @param amount Amount of OETH to mint
     */
    function mintClamped(uint256 amount) public setCurrentActor {
        if (weth.balanceOf(currentActor) == 0) revert FuzzRequireError();
        amount = clampBetween(amount, 1, weth.balanceOf(currentActor));

        uint256 wethBalBefore = weth.balanceOf(currentActor);
        uint256 oethBalBefore = oeth.balanceOf(currentActor);
        uint256 vaultBalBefore = weth.balanceOf(address(vault));

        vm.prank(currentActor);
        try vault.mint(address(weth), amount, 0) {
            uint256 wethBalAfter = weth.balanceOf(currentActor);
            uint256 oethBalAfter = oeth.balanceOf(currentActor);
            uint256 vaultBalAfter = weth.balanceOf(address(vault));

            uint256 wethBalDiff = diff(wethBalBefore - amount, wethBalAfter);
            uint256 oethBalDiff = diff(oethBalBefore + amount, oethBalAfter);
            uint256 vaultBalDiff = diff(vaultBalBefore + amount, vaultBalAfter);

            lte(
                wethBalDiff,
                MINT_TOLERANCE,
                "VAULT-01: User WETH balance should decrease by mint amount"
            );
            lte(
                oethBalDiff,
                MINT_TOLERANCE,
                "VAULT-02: User OETH balance should increase by mint amount"
            );
            lte(
                vaultBalDiff,
                MINT_TOLERANCE,
                "VAULT-03: Vault WETH balance should increase by mint amount"
            );
        } catch {
            t(false, "VAULT-04: No unwanted reverts in mint");
        }
    }

    /**
     * @notice Redeem OETH without clamping
     * @param amount Amount of OETH to redeem
     */
    function redeem(uint256 amount) public setCurrentActor {
        vm.prank(currentActor);
        vault.redeem(amount, 0);
    }

    /**
     * @notice Redeem OETH with clamping
     * @param amount Amount of OETH to redeem
     */
    function redeemClamped(uint256 amount) public setCurrentActor {
        if (oeth.balanceOf(currentActor) == 0) revert FuzzRequireError();
        amount = clampBetween(amount, 1, oeth.balanceOf(currentActor));

        uint256 wethBalBefore = weth.balanceOf(currentActor);
        uint256 oethBalBefore = oeth.balanceOf(currentActor);
        uint256 vaultBalBefore = weth.balanceOf(address(vault));

        vm.prank(currentActor);
        try vault.redeem(amount, 0) {
            uint256 wethBalAfter = weth.balanceOf(currentActor);
            uint256 oethBalAfter = oeth.balanceOf(currentActor);
            uint256 vaultBalAfter = weth.balanceOf(address(vault));

            uint256 wethBalDiff = diff(wethBalBefore + amount, wethBalAfter);
            uint256 oethBalDiff = diff(oethBalBefore - amount, oethBalAfter);
            uint256 vaultBalDiff = diff(vaultBalBefore - amount, vaultBalAfter);

            lte(
                wethBalDiff,
                REDEEM_TOLERANCE,
                "VAULT-05: User WETH balance should increase by redeem amount"
            );
            lte(
                oethBalDiff,
                REDEEM_TOLERANCE,
                "VAULT-06: User OETH balance should decrease by redeem amount"
            );
            lte(
                vaultBalDiff,
                REDEEM_TOLERANCE,
                "VAULT-07: Vault WETH balance should decrease by redeem amount"
            );
        } catch {
            t(false, "VAULT-08: No unwanted reverts in redeem");
        }
    }

    /**
     * @notice Redeem all OETH
     */
    function redeemAll() public setCurrentActor {
        vm.prank(currentActor);
        vault.redeemAll(0);

        uint256 balanceAfter = oeth.balanceOf(currentActor);
        lte(
            balanceAfter,
            REDEEM_TOLERANCE,
            "VAULT-09: User OETH balance should be 0 after redeemAll"
        );
    }

    /**
     * @notice All users holding OETH should be able to redeem their holdings
     * @dev This test does not change state
     */
    function redeemAllShouldNotRevert() public {
        uint256 forkId = vm.createFork("");
        vm.selectFork(forkId);

        // To prevent rounding issues we use extra outsiders to mint a small
        // amount of OETH to the vault.
        uint256 buffer = REDEEM_ALL_TOLERANCE / 2;
        address outsider = address(0xDEADBEEF);
        weth.mint(buffer);
        weth.transfer(outsider, buffer);
        vm.prank(outsider);
        weth.approve(address(vault), type(uint256).max);
        vm.prank(outsider);
        vault.mint(address(weth), buffer, 0);
        address outsider2 = address(0xDEADBEEF2);
        vm.prank(outsider2);
        oeth.rebaseOptOut();
        weth.mint(buffer);
        weth.transfer(outsider2, buffer);
        vm.prank(outsider2);
        weth.approve(address(vault), type(uint256).max);
        vm.prank(outsider2);
        vault.mint(address(weth), buffer, 0);

        vm.prank(ADDRESS_OUTSIDER_NONREBASING);
        try vault.redeemAll(0) {} catch {
            t(false, "GLOBAL: redeemAll should never revert");
        }

        vm.prank(ADDRESS_OUTSIDER_REBASING);
        try vault.redeemAll(0) {} catch {
            t(false, "GLOBAL: redeemAll should never revert");
        }

        for (uint i = 0; i < ACTORS.length; i++) {
            vm.prank(ACTORS[i]);
            try vault.redeemAll(0) {} catch {
                t(false, "GLOBAL: redeemAll should never revert");
            }
        }

        vm.selectFork(0);
    }

    /**
     * @notice Donate WETH to the vault and rebase
     * @param amount Amount of WETH to donate
     * @dev This simulated yield generated from strategies
     */
    function donateAndRebase(uint256 amount) public setCurrentActor {
        if (weth.balanceOf(currentActor) == 0) revert FuzzRequireError();
        amount = clampBetween(amount, 1, weth.balanceOf(currentActor));
        vm.prank(currentActor);

        try weth.transfer(address(vault), amount) {
            totalDonated += amount;
        } catch {
            t(false, "VAULT-10: Donating WETH to Vault should never revert");
        }

        uint totalOethBefore = getTotalOethBalanceInclOutsiders();

        uint256[] memory balancesBefore = new uint256[](ACTORS.length);
        for (uint256 i = 0; i < ACTORS.length; i++) {
            balancesBefore[i] = oeth.balanceOf(ACTORS[i]);
        }

        try vault.rebase() {
            uint totalOethAfter = getTotalOethBalanceInclOutsiders();

            for (uint256 i = 0; i < ACTORS.length; i++) {
                uint256 balanceAfter = oeth.balanceOf(ACTORS[i]);

                if (balanceAfter < balancesBefore[i]) {
                    uint256 diff = diff(balanceAfter, balancesBefore[i]);

                    lte(
                        diff,
                        BALANCE_AFTER_REBASE_TOLERANCE,
                        "VAULT-11: Rebase should never decrease OETH balance for users"
                    );
                }
            }

            if (totalOethAfter > totalOethBefore) {
                totalYield += totalOethAfter - totalOethBefore;
            }
        } catch {
            t(false, "VAULT-12: Rebase should never revert");
        }
    }
}
