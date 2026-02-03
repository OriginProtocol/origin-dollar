// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OToken VaultAdmin contract
 * @notice The VaultAdmin contract makes configuration and admin calls on the vault.
 * @author Origin Protocol Inc
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IVault } from "../interfaces/IVault.sol";
import { StableMath } from "../utils/StableMath.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import "./VaultCore.sol";

abstract contract VaultAdmin is VaultCore {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    using SafeCast for uint256;

    /**
     * @dev Verifies that the caller is the Governor or Strategist.
     */
    modifier onlyGovernorOrStrategist() {
        require(
            msg.sender == strategistAddr || isGovernor(),
            "Caller is not the Strategist or Governor"
        );
        _;
    }

    constructor(address _asset) VaultCore(_asset) {}

    /***************************************
                 Configuration
    ****************************************/
    /**
     * @notice Set a buffer of asset to keep in the Vault to handle most
     * redemptions without needing to spend gas unwinding asset from a Strategy.
     * @param _vaultBuffer Percentage using 18 decimals. 100% = 1e18.
     */
    function setVaultBuffer(uint256 _vaultBuffer)
        external
        onlyGovernorOrStrategist
    {
        require(_vaultBuffer <= 1e18, "Invalid value");
        vaultBuffer = _vaultBuffer;
        emit VaultBufferUpdated(_vaultBuffer);
    }

    /**
     * @notice Sets the minimum amount of OTokens in a mint to trigger an
     * automatic allocation of funds afterwords.
     * @param _threshold OToken amount with 18 fixed decimals.
     */
    function setAutoAllocateThreshold(uint256 _threshold)
        external
        onlyGovernor
    {
        autoAllocateThreshold = _threshold;
        emit AllocateThresholdUpdated(_threshold);
    }

    /**
     * @notice Set a minimum amount of OTokens in a mint or redeem that triggers a
     * rebase
     * @param _threshold OToken amount with 18 fixed decimals.
     */
    function setRebaseThreshold(uint256 _threshold) external onlyGovernor {
        rebaseThreshold = _threshold;
        emit RebaseThresholdUpdated(_threshold);
    }

    /**
     * @notice Set address of Strategist
     * @param _address Address of Strategist
     */
    function setStrategistAddr(address _address) external onlyGovernor {
        strategistAddr = _address;
        emit StrategistUpdated(_address);
    }

    /**
     * @notice Set the default Strategy for asset, i.e. the one which
     * the asset will be automatically allocated to and withdrawn from
     * @param _strategy Address of the Strategy
     */
    function setDefaultStrategy(address _strategy)
        external
        onlyGovernorOrStrategist
    {
        emit DefaultStrategyUpdated(_strategy);
        // If its a zero address being passed for the strategy we are removing
        // the default strategy
        if (_strategy != address(0)) {
            // Make sure the strategy meets some criteria
            require(strategies[_strategy].isSupported, "Strategy not approved");
            require(
                IStrategy(_strategy).supportsAsset(asset),
                "Asset not supported by Strategy"
            );
        }
        defaultStrategy = _strategy;
    }

    /**
     * @notice Changes the async withdrawal claim period for OETH & superOETHb
     * @param _delay Delay period (should be between 10 mins to 7 days).
     *          Set to 0 to disable async withdrawals
     */
    function setWithdrawalClaimDelay(uint256 _delay) external onlyGovernor {
        require(
            _delay == 0 || (_delay >= 10 minutes && _delay <= 15 days),
            "Invalid claim delay period"
        );
        withdrawalClaimDelay = _delay;
        emit WithdrawalClaimDelayUpdated(_delay);
    }

    // slither-disable-start reentrancy-no-eth
    /**
     * @notice Set a yield streaming max rate. This spreads yield over
     * time if it is above the max rate.
     * @param yearlyApr in 1e18 notation. 3 * 1e18 = 3% APR
     */
    function setRebaseRateMax(uint256 yearlyApr)
        external
        onlyGovernorOrStrategist
    {
        // The old yield will be at the old rate
        _rebase();
        // Change the rate
        uint256 newPerSecond = yearlyApr / 100 / 365 days;
        require(newPerSecond <= MAX_REBASE_PER_SECOND, "Rate too high");
        rebasePerSecondMax = newPerSecond.toUint64();
        emit RebasePerSecondMaxChanged(newPerSecond);
    }

    // slither-disable-end reentrancy-no-eth

    // slither-disable-start reentrancy-no-eth
    /**
     * @notice Set the drip duration period
     * @param _dripDuration Time in seconds to target a constant yield rate
     */
    function setDripDuration(uint256 _dripDuration)
        external
        onlyGovernorOrStrategist
    {
        // The old yield will be at the old rate
        _rebase();
        dripDuration = _dripDuration.toUint64();
        emit DripDurationChanged(_dripDuration);
    }

    // slither-disable-end reentrancy-no-eth

    /***************************************
                Strategy Config
    ****************************************/

    /**
     * @notice Add a strategy to the Vault.
     * @param _addr Address of the strategy to add
     */
    function approveStrategy(address _addr) external onlyGovernor {
        require(!strategies[_addr].isSupported, "Strategy already approved");
        require(
            IStrategy(_addr).supportsAsset(asset),
            "Asset not supported by Strategy"
        );
        strategies[_addr] = Strategy({ isSupported: true, _deprecated: 0 });
        allStrategies.push(_addr);
        emit StrategyApproved(_addr);
    }

    /**
     * @notice Remove a strategy from the Vault.
     * @param _addr Address of the strategy to remove
     */

    function removeStrategy(address _addr) external onlyGovernor {
        require(strategies[_addr].isSupported, "Strategy not approved");
        require(defaultStrategy != _addr, "Strategy is default for asset");

        // Initialize strategyIndex with out of bounds result so function will
        // revert if no valid index found
        uint256 stratCount = allStrategies.length;
        uint256 strategyIndex = stratCount;
        for (uint256 i = 0; i < stratCount; ++i) {
            if (allStrategies[i] == _addr) {
                strategyIndex = i;
                break;
            }
        }

        if (strategyIndex < stratCount) {
            allStrategies[strategyIndex] = allStrategies[stratCount - 1];
            allStrategies.pop();

            // Mark the strategy as not supported
            strategies[_addr].isSupported = false;

            // Withdraw all asset
            IStrategy strategy = IStrategy(_addr);
            strategy.withdrawAll();

            // 1e13 for 18 decimals. And 1e1(10) for 6 decimals
            uint256 maxDustBalance = uint256(1e13).scaleBy(assetDecimals, 18);

            /*
             * Some strategies are not able to withdraw all of their funds in a synchronous call.
             * Prevent the possible accidental removal of such strategies before their funds are withdrawn.
             */
            require(
                strategy.checkBalance(asset) < maxDustBalance,
                "Strategy has funds"
            );
            emit StrategyRemoved(_addr);
        }
    }

    /**
     * @notice Adds a strategy to the mint whitelist.
     *          Reverts if strategy isn't approved on Vault.
     * @param strategyAddr Strategy address
     */
    function addStrategyToMintWhitelist(address strategyAddr)
        external
        onlyGovernor
    {
        require(strategies[strategyAddr].isSupported, "Strategy not approved");

        require(
            !isMintWhitelistedStrategy[strategyAddr],
            "Already whitelisted"
        );

        isMintWhitelistedStrategy[strategyAddr] = true;

        emit StrategyAddedToMintWhitelist(strategyAddr);
    }

    /**
     * @notice Removes a strategy from the mint whitelist.
     * @param strategyAddr Strategy address
     */
    function removeStrategyFromMintWhitelist(address strategyAddr)
        external
        onlyGovernor
    {
        // Intentionally skipping `strategies.isSupported` check since
        // we may wanna remove an address even after removing the strategy

        require(isMintWhitelistedStrategy[strategyAddr], "Not whitelisted");

        isMintWhitelistedStrategy[strategyAddr] = false;

        emit StrategyRemovedFromMintWhitelist(strategyAddr);
    }

    /***************************************
                Strategies
    ****************************************/

    /**
     * @notice Deposit multiple asset from the vault into the strategy.
     * @param _strategyToAddress Address of the Strategy to deposit asset into.
     * @param _assets Array of asset address that will be deposited into the strategy.
     * @param _amounts Array of amounts of each corresponding asset to deposit.
     */
    function depositToStrategy(
        address _strategyToAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external onlyGovernorOrStrategist nonReentrant {
        _depositToStrategy(_strategyToAddress, _assets, _amounts);
    }

    function _depositToStrategy(
        address _strategyToAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) internal virtual {
        require(
            strategies[_strategyToAddress].isSupported,
            "Invalid to Strategy"
        );
        require(
            _assets.length == 1 && _amounts.length == 1 && _assets[0] == asset,
            "Only asset is supported"
        );

        // Check the there is enough asset to transfer once the backing
        // asset reserved for the withdrawal queue is accounted for
        require(
            _amounts[0] <= _assetAvailable(),
            "Not enough assets available"
        );

        // Send required amount of funds to the strategy
        IERC20(asset).safeTransfer(_strategyToAddress, _amounts[0]);

        // Deposit all the funds that have been sent to the strategy
        IStrategy(_strategyToAddress).depositAll();
    }

    /**
     * @notice Withdraw multiple asset from the strategy to the vault.
     * @param _strategyFromAddress Address of the Strategy to withdraw asset from.
     * @param _assets Array of asset address that will be withdrawn from the strategy.
     * @param _amounts Array of amounts of each corresponding asset to withdraw.
     */
    function withdrawFromStrategy(
        address _strategyFromAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external onlyGovernorOrStrategist nonReentrant {
        _withdrawFromStrategy(
            address(this),
            _strategyFromAddress,
            _assets,
            _amounts
        );
    }

    /**
     * @param _recipient can either be a strategy or the Vault
     */
    function _withdrawFromStrategy(
        address _recipient,
        address _strategyFromAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) internal virtual {
        require(
            strategies[_strategyFromAddress].isSupported,
            "Invalid from Strategy"
        );
        require(_assets.length == _amounts.length, "Parameter length mismatch");

        uint256 assetCount = _assets.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            // Withdraw from Strategy to the recipient
            IStrategy(_strategyFromAddress).withdraw(
                _recipient,
                _assets[i],
                _amounts[i]
            );
        }

        _addWithdrawalQueueLiquidity();
    }

    /**
     * @notice Sets the maximum allowable difference between
     * total supply and asset' value.
     */
    function setMaxSupplyDiff(uint256 _maxSupplyDiff) external onlyGovernor {
        maxSupplyDiff = _maxSupplyDiff;
        emit MaxSupplyDiffChanged(_maxSupplyDiff);
    }

    /**
     * @notice Sets the trusteeAddress that can receive a portion of yield.
     *      Setting to the zero address disables this feature.
     */
    function setTrusteeAddress(address _address) external onlyGovernor {
        trusteeAddress = _address;
        emit TrusteeAddressChanged(_address);
    }

    /**
     * @notice Sets the TrusteeFeeBps to the percentage of yield that should be
     *      received in basis points.
     */
    function setTrusteeFeeBps(uint256 _basis) external onlyGovernor {
        require(_basis <= 5000, "basis cannot exceed 50%");
        trusteeFeeBps = _basis;
        emit TrusteeFeeBpsChanged(_basis);
    }

    /***************************************
                    Pause
    ****************************************/

    /**
     * @notice Set the deposit paused flag to true to prevent rebasing.
     */
    function pauseRebase() external onlyGovernorOrStrategist {
        rebasePaused = true;
        emit RebasePaused();
    }

    /**
     * @notice Set the deposit paused flag to true to allow rebasing.
     */
    function unpauseRebase() external onlyGovernorOrStrategist {
        rebasePaused = false;
        emit RebaseUnpaused();
    }

    /**
     * @notice Set the deposit paused flag to true to prevent capital movement.
     */
    function pauseCapital() external onlyGovernorOrStrategist {
        capitalPaused = true;
        emit CapitalPaused();
    }

    /**
     * @notice Set the deposit paused flag to false to enable capital movement.
     */
    function unpauseCapital() external onlyGovernorOrStrategist {
        capitalPaused = false;
        emit CapitalUnpaused();
    }

    /***************************************
                    Utils
    ****************************************/

    /**
     * @notice Transfer token to governor. Intended for recovering tokens stuck in
     *      contract, i.e. mistaken sends.
     * @param _asset Address for the asset
     * @param _amount Amount of the asset to transfer
     */
    function transferToken(address _asset, uint256 _amount)
        external
        onlyGovernor
    {
        require(asset != _asset, "Only unsupported asset");
        IERC20(_asset).safeTransfer(governor(), _amount);
    }

    /***************************************
             Strategies Admin
    ****************************************/

    /**
     * @notice Withdraws all asset from the strategy and sends asset to the Vault.
     * @param _strategyAddr Strategy address.
     */
    function withdrawAllFromStrategy(address _strategyAddr)
        external
        onlyGovernorOrStrategist
    {
        _withdrawAllFromStrategy(_strategyAddr);
    }

    function _withdrawAllFromStrategy(address _strategyAddr) internal virtual {
        require(
            strategies[_strategyAddr].isSupported,
            "Strategy is not supported"
        );
        IStrategy strategy = IStrategy(_strategyAddr);
        strategy.withdrawAll();
        _addWithdrawalQueueLiquidity();
    }

    /**
     * @notice Withdraws all asset from all the strategies and sends asset to the Vault.
     */
    function withdrawAllFromStrategies() external onlyGovernorOrStrategist {
        _withdrawAllFromStrategies();
    }

    function _withdrawAllFromStrategies() internal virtual {
        uint256 stratCount = allStrategies.length;
        for (uint256 i = 0; i < stratCount; ++i) {
            IStrategy(allStrategies[i]).withdrawAll();
        }
        _addWithdrawalQueueLiquidity();
    }
}
