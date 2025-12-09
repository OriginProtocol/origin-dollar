// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { StableMath } from "../utils/StableMath.sol";
import { VaultCore } from "./VaultCore.sol";

/**
 * @title OETH VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultCore is VaultCore {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    // For future use (because OETHBaseVaultCore inherits from this)
    uint256[50] private __gap;

    constructor(address _backingAsset) VaultCore(_backingAsset) {}

    // @inheritdoc VaultCore
    function mintForStrategy(uint256 amount)
        external
        override
        whenNotCapitalPaused
    {
        require(
            strategies[msg.sender].isSupported == true,
            "Unsupported strategy"
        );
        require(
            isMintWhitelistedStrategy[msg.sender] == true,
            "Not whitelisted strategy"
        );

        emit Mint(msg.sender, amount);

        // Mint matching amount of OTokens
        oUSD.mint(msg.sender, amount);
    }

    // @inheritdoc VaultCore
    function burnForStrategy(uint256 amount)
        external
        override
        whenNotCapitalPaused
    {
        require(
            strategies[msg.sender].isSupported == true,
            "Unsupported strategy"
        );
        require(
            isMintWhitelistedStrategy[msg.sender] == true,
            "Not whitelisted strategy"
        );

        emit Redeem(msg.sender, amount);

        // Burn OTokens
        oUSD.burn(msg.sender, amount);
    }

    /// @notice Adds WETH to the withdrawal queue if there is a funding shortfall.
    /// @dev is called from the Native Staking strategy when validator withdrawals are processed.
    /// It also called before any WETH is allocated to a strategy.
    function addWithdrawalQueueLiquidity() external {
        _addWithdrawalQueueLiquidity();
    }

    /***************************************
                View Functions
    ****************************************/

    /// @dev The total value of all WETH held by the vault and all its strategies
    /// less any WETH that is reserved for the withdrawal queue.
    ///
    // If there is not enough WETH in the vault and all strategies to cover all outstanding
    // withdrawal requests then return a total value of 0.
    function _totalValue() internal view override returns (uint256 value) {
        // As WETH is the only asset, just return the WETH balance
        return _checkBalance(backingAsset);
    }

    /// @dev Only WETH is supported in the OETH Vault so return the WETH balance only
    /// Any ETH balances in the Vault will be ignored.
    /// Amounts from previously supported vault assets will also be ignored.
    /// For example, there is 1 wei left of stETH in the OETH Vault but is will be ignored.
    function _totalValueInVault()
        internal
        view
        override
        returns (uint256 value)
    {
        value = IERC20(backingAsset).balanceOf(address(this));
    }
}
