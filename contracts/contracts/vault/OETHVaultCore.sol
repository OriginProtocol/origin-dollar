// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { StableMath } from "../utils/StableMath.sol";

import { VaultCore } from "./VaultCore.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";

/**
 * @title OETH VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultCore is VaultCore {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    error NotSupported();

    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    /**
     * @notice Deposit WETH and mint OETH.
     * @param _amount Amount of WETH being deposited
     */
    function mint(
        uint256 _amount
    ) external whenNotCapitalPaused nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");

        emit Mint(msg.sender, _amount);

        // Rebase must happen before any transfers occur.
        if (_amount >= rebaseThreshold && !rebasePaused) {
            _rebase();
        }

        // Mint matching amount of OTokens
        oUSD.mint(msg.sender, _amount);

        // Transfer the deposited coins to the vault
        IERC20(WETH).safeTransferFrom(msg.sender, address(this), _amount);

        if (_amount >= autoAllocateThreshold) {
            //_allocate();
        }
  }

    /**
     * @notice not supported
     */
    function mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumOusdAmount
    ) external override whenNotCapitalPaused nonReentrant {
        revert NotSupported();
    }

    /**
     * @notice Withdraw WETH and burn OTokens.
     * @param _amount Amount of OTokens to burn
     */
    function redeem(uint256 _amount)
        external
        whenNotCapitalPaused
        nonReentrant
    {
        _redeem(_amount);
    }

    /**
     * @notice Withdraw WETH and burn all OTokens.
     */
    function redeemAll()
        external
        whenNotCapitalPaused
        nonReentrant
    {
        _redeem(oUSD.balanceOf(msg.sender));
    }

    /**
     * @notice Withdraw WETH and burn OTokens.
     * @param _amount Amount of OTokens to burn
     */
    function _redeem(uint256 _amount) internal {
        emit Redeem(msg.sender, _amount);

        if (IERC20(WETH).balanceOf(address(this)) >= _amount) {
            // Use Vault funds first if sufficient
            IERC20(WETH).safeTransfer(msg.sender, _amount);
        } else {
            address strategyAddr = assetDefaultStrategies[WETH];
            if (strategyAddr != address(0)) {
                // Nothing in Vault, but something in Strategy, send from there
                IStrategy strategy = IStrategy(strategyAddr);
                strategy.withdraw(msg.sender, WETH, _amount);
            } else {
                // Can't find funds anywhere
                revert("Liquidity error");
            }
        }

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
            // backing assets value and OUSD total supply
            uint256 diff = oUSD.totalSupply().divPrecisely(totalUnits);
            require(
                (diff > 1e18 ? diff - 1e18 : 1e18 - diff) <= maxSupplyDiff,
                "Backing supply liquidity error"
            );
        }
    }

    /**
     * @notice Withdraw a supported asset and burn OTokens.
     * @param _amount Amount of OTokens to burn
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function redeem(uint256 _amount, uint256 _minimumUnitAmount)
        external override
        whenNotCapitalPaused
        nonReentrant
    {
        revert NotSupported();
    }

    /**
     * @notice Withdraw a supported asset and burn all OTokens.
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function redeemAll(uint256 _minimumUnitAmount)
        external override
        whenNotCapitalPaused
        nonReentrant
    {
        revert NotSupported();
    }
}
