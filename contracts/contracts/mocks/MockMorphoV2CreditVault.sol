// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { MockERC4626Vault } from "./MockERC4626Vault.sol";

/**
 * @title Mock Morpho Vault V2 credit vault
 * @notice ERC-4626 mock that decouples the reported position value (previewRedeem) from the
 *         liquid balance available to withdraw, so tests can model accrued-but-unrealized
 *         interest and OToken that has been borrowed out.
 * @dev Mirrors production: maxWithdraw()/maxRedeem() return 0 (the strategy reads liquidity via
 *      MorphoV2VaultUtils, not these), and a liquidityAdapter() getter is exposed. The strategy
 *      is the sole depositor in the gated vault, so it always holds 100% of the shares and
 *      previewRedeem(allShares) == reported total assets.
 */
contract MockMorphoV2CreditVault is MockERC4626Vault {
    using SafeERC20 for IERC20;

    /// @notice Reported total assets, driving previewRedeem independent of the idle balance.
    uint256 private _reportedTotalAssets;

    /// @notice The Morpho V1 liquidity adapter address.
    address public liquidityAdapter;

    constructor(address _asset) MockERC4626Vault(_asset) {}

    function setLiquidityAdapter(address _liquidityAdapter) external {
        liquidityAdapter = _liquidityAdapter;
    }

    /// @dev Reported value, not the idle token balance.
    function totalAssets() public view override returns (uint256) {
        return _reportedTotalAssets;
    }

    function deposit(uint256 assets, address receiver)
        public
        override
        returns (uint256 shares)
    {
        shares = super.deposit(assets, receiver);
        _reportedTotalAssets += assets;
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override returns (uint256 shares) {
        shares = super.withdraw(assets, receiver, owner);
        _reportedTotalAssets -= assets;
    }

    /// @notice Simulate interest accruing as a claim: lifts previewRedeem without adding liquidity.
    function simulateInterest(uint256 amount) external {
        _reportedTotalAssets += amount;
    }

    /// @notice Simulate OToken being borrowed/drawn: removes idle liquidity without changing value.
    function simulateBorrow(uint256 amount, address to) external {
        IERC20(asset).safeTransfer(to, amount);
    }

    /// @dev Morpho V2 vaults return 0 from these; liquidity is read via MorphoV2VaultUtils.
    function maxWithdraw(address) public view override returns (uint256) {
        return 0;
    }

    function maxRedeem(address) public view override returns (uint256) {
        return 0;
    }
}
