// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StableMath } from "../utils/StableMath.sol";
import { VaultCore } from "./VaultCore.sol";

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";

/**
 * @title OETH VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultCore is VaultCore {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    address public immutable weth;
    uint256 public wethAssetIndex;

    constructor(address _weth) {
        weth = _weth;
    }

    /**
     * @dev Caches WETH's index in `allAssets` variable.
     *      Reduces gas usage by redeem by caching that.
     */
    function cacheWETHAssetIndex() external onlyGovernor {
        uint256 assetCount = allAssets.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            if (allAssets[i] == weth) {
                wethAssetIndex = i;
                break;
            }
        }

        require(allAssets[wethAssetIndex] == weth, "Invalid WETH Asset Index");
    }

    // @inheritdoc VaultCore
    function mint(
        address _asset,
        uint256 _amount,
        uint256
    ) external virtual override whenNotCapitalPaused nonReentrant {
        require(_asset == weth, "Unsupported asset for minting");
        require(_amount > 0, "Amount must be greater than 0");

        emit Mint(msg.sender, _amount);

        // Rebase must happen before any transfers occur.
        if (!rebasePaused && _amount >= rebaseThreshold) {
            _rebase();
        }

        // Mint oTokens
        oUSD.mint(msg.sender, _amount);

        // Transfer the deposited coins to the vault
        IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amount);

        // Auto-allocate if necessary
        if (_amount >= autoAllocateThreshold) {
            _allocate();
        }
    }

    // @inheritdoc VaultCore
    function _calculateRedeemOutputs(uint256 _amount)
        internal
        view
        virtual
        override
        returns (uint256[] memory outputs)
    {
        // Overrides `VaultCore._calculateRedeemOutputs` to redeem with only
        // WETH instead of LST-mix and gets rid of fee. Doesn't change the
        // function signature for backward compatibility

        // Ensure that the WETH index is cached
        uint256 wethIndex = wethAssetIndex;
        require(allAssets[wethIndex] == weth, "WETH Asset index not cached");

        outputs = new uint256[](allAssets.length);
        outputs[wethIndex] = _amount;
    }

    // @inheritdoc VaultCore
    function _redeem(uint256 _amount, uint256) internal virtual override {
        // Override `VaultCore._redeem` to simplify it. Gets rid of oracle
        // usage and looping through all assets for LST-mix redeem. Instead
        // does a simple WETH-only redeem with zero fee.
        emit Redeem(msg.sender, _amount);

        if (IERC20(weth).balanceOf(address(this)) >= _amount) {
            // Use Vault funds first if sufficient
            IERC20(weth).safeTransfer(msg.sender, _amount);
        } else {
            address strategyAddr = assetDefaultStrategies[weth];
            if (strategyAddr != address(0)) {
                // Nothing in Vault, but something in Strategy, send from there
                IStrategy strategy = IStrategy(strategyAddr);
                strategy.withdraw(msg.sender, weth, _amount);
            } else {
                // Cant find funds anywhere
                revert("Liquidity error");
            }
        }

        // Burn OETH from user
        oUSD.burn(msg.sender, _amount);

        // Until we can prove that we won't affect the prices of our assets
        // by withdrawing them, this should be here.
        // It's possible that a strategy was off on its asset total, perhaps
        // a reward token sold for more or for less than anticipated.
        uint256 totalUnits = 0;
        if (_amount >= rebaseThreshold && !rebasePaused) {
            totalUnits = _rebase();
        } else {
            totalUnits = _totalValue();
        }

        // Check that the OTokens are backed by enough assets
        if (maxSupplyDiff > 0) {
            // Allow a max difference of maxSupplyDiff% between
            // backing assets value and OETH total supply
            uint256 diff = oUSD.totalSupply().divPrecisely(totalUnits);
            require(
                (diff > 1e18 ? diff - 1e18 : 1e18 - diff) <= maxSupplyDiff,
                "Backing supply liquidity error"
            );
        }
    }
}
