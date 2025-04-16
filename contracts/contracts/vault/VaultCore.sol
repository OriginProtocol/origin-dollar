// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OToken VaultCore contract
 * @notice The Vault contract stores assets. On a deposit, OTokens will be minted
           and sent to the depositor. On a withdrawal, OTokens will be burned and
           assets will be sent to the withdrawer. The Vault accepts deposits of
           interest from yield bearing strategies which will modify the supply
           of OTokens.
 * @author Origin Protocol Inc
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { StableMath } from "../utils/StableMath.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IGetExchangeRateToken } from "../interfaces/IGetExchangeRateToken.sol";
import { IDripper } from "../interfaces/IDripper.sol";

import "./VaultInitializer.sol";

contract VaultCore is VaultInitializer {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    /// @dev max signed int
    uint256 internal constant MAX_INT = uint256(type(int256).max);

    /**
     * @dev Verifies that the rebasing is not paused.
     */
    modifier whenNotRebasePaused() {
        require(!rebasePaused, "Rebasing paused");
        _;
    }

    /**
     * @dev Verifies that the deposits are not paused.
     */
    modifier whenNotCapitalPaused() {
        require(!capitalPaused, "Capital paused");
        _;
    }

    /**
     * @dev Verifies that the caller is the AMO strategy.
     */
    modifier onlyOusdMetaStrategy() {
        require(
            msg.sender == ousdMetaStrategy,
            "Caller is not the OUSD meta strategy"
        );
        _;
    }

    /**
     * @notice Deposit a supported asset and mint OTokens.
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited
     * @param _minimumOusdAmount Minimum OTokens to mint
     */
    function mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumOusdAmount
    ) external whenNotCapitalPaused nonReentrant {
        _mint(_asset, _amount, _minimumOusdAmount);
    }

    /**
     * @dev Deposit a supported asset and mint OTokens.
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited
     * @param _minimumOusdAmount Minimum OTokens to mint
     */
    function _mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumOusdAmount
    ) internal virtual {
        require(assets[_asset].isSupported, "Asset is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        uint256 units = _toUnits(_amount, _asset);
        uint256 unitPrice = _toUnitPrice(_asset, true);
        uint256 priceAdjustedDeposit = (units * unitPrice) / 1e18;

        if (_minimumOusdAmount > 0) {
            require(
                priceAdjustedDeposit >= _minimumOusdAmount,
                "Mint amount lower than minimum"
            );
        }

        emit Mint(msg.sender, priceAdjustedDeposit);

        // Rebase must happen before any transfers occur.
        if (priceAdjustedDeposit >= rebaseThreshold && !rebasePaused) {
            if (dripper != address(0)) {
                // Stream any harvested rewards that are available
                IDripper(dripper).collect();
            }
            _rebase();
        }

        // Mint matching amount of OTokens
        oUSD.mint(msg.sender, priceAdjustedDeposit);

        // Transfer the deposited coins to the vault
        IERC20 asset = IERC20(_asset);
        asset.safeTransferFrom(msg.sender, address(this), _amount);

        if (priceAdjustedDeposit >= autoAllocateThreshold) {
            _allocate();
        }
    }

    /**
     * @notice Mint OTokens for a Metapool Strategy
     * @param _amount Amount of the asset being deposited
     *
     * Notice: can't use `nonReentrant` modifier since the `mint` function can
     * call `allocate`, and that can trigger `ConvexOUSDMetaStrategy` to call this function
     * while the execution of the `mint` has not yet completed -> causing a `nonReentrant` collision.
     *
     * Also important to understand is that this is a limitation imposed by the test suite.
     * Production / mainnet contracts should never be configured in a way where mint/redeem functions
     * that are moving funds between the Vault and end user wallets can influence strategies
     * utilizing this function.
     */
    function mintForStrategy(uint256 _amount)
        external
        virtual
        whenNotCapitalPaused
        onlyOusdMetaStrategy
    {
        require(_amount < MAX_INT, "Amount too high");

        emit Mint(msg.sender, _amount);

        // safe to cast because of the require check at the beginning of the function
        netOusdMintedForStrategy += int256(_amount);

        require(
            abs(netOusdMintedForStrategy) < netOusdMintForStrategyThreshold,
            "Minted ousd surpassed netOusdMintForStrategyThreshold."
        );

        // Mint matching amount of OTokens
        oUSD.mint(msg.sender, _amount);
    }

    // In memoriam

    /**
     * @notice Withdraw a supported asset and burn OTokens.
     * @param _amount Amount of OTokens to burn
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function redeem(uint256 _amount, uint256 _minimumUnitAmount)
        external
        whenNotCapitalPaused
        nonReentrant
    {
        _redeem(_amount, _minimumUnitAmount);
    }

    /**
     * @notice Withdraw a supported asset and burn OTokens.
     * @param _amount Amount of OTokens to burn
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function _redeem(uint256 _amount, uint256 _minimumUnitAmount)
        internal
        virtual
    {
        // Calculate redemption outputs
        uint256[] memory outputs = _calculateRedeemOutputs(_amount);

        emit Redeem(msg.sender, _amount);

        // Send outputs
        uint256 assetCount = allAssets.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            if (outputs[i] == 0) continue;

            address assetAddr = allAssets[i];

            if (IERC20(assetAddr).balanceOf(address(this)) >= outputs[i]) {
                // Use Vault funds first if sufficient
                IERC20(assetAddr).safeTransfer(msg.sender, outputs[i]);
            } else {
                address strategyAddr = assetDefaultStrategies[assetAddr];
                if (strategyAddr != address(0)) {
                    // Nothing in Vault, but something in Strategy, send from there
                    IStrategy strategy = IStrategy(strategyAddr);
                    strategy.withdraw(msg.sender, assetAddr, outputs[i]);
                } else {
                    // Cant find funds anywhere
                    revert("Liquidity error");
                }
            }
        }

        if (_minimumUnitAmount > 0) {
            uint256 unitTotal = 0;
            for (uint256 i = 0; i < outputs.length; ++i) {
                unitTotal += _toUnits(outputs[i], allAssets[i]);
            }
            require(
                unitTotal >= _minimumUnitAmount,
                "Redeem amount lower than minimum"
            );
        }

        oUSD.burn(msg.sender, _amount);

        _postRedeem(_amount);
    }

    function _postRedeem(uint256 _amount) internal {
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
            // If there are more outstanding withdrawal requests than assets in the vault and strategies
            // then the available assets will be negative and totalUnits will be rounded up to zero.
            // As we don't know the exact shortfall amount, we will reject all redeem and withdrawals
            require(totalUnits > 0, "Too many outstanding requests");

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
     * @notice Burn OTokens for Metapool Strategy
     * @param _amount Amount of OUSD to burn
     *
     * @dev Notice: can't use `nonReentrant` modifier since the `redeem` function could
     * require withdrawal on `ConvexOUSDMetaStrategy` and that one can call `burnForStrategy`
     * while the execution of the `redeem` has not yet completed -> causing a `nonReentrant` collision.
     *
     * Also important to understand is that this is a limitation imposed by the test suite.
     * Production / mainnet contracts should never be configured in a way where mint/redeem functions
     * that are moving funds between the Vault and end user wallets can influence strategies
     * utilizing this function.
     */
    function burnForStrategy(uint256 _amount)
        external
        virtual
        whenNotCapitalPaused
        onlyOusdMetaStrategy
    {
        require(_amount < MAX_INT, "Amount too high");

        emit Redeem(msg.sender, _amount);

        // safe to cast because of the require check at the beginning of the function
        netOusdMintedForStrategy -= int256(_amount);

        require(
            abs(netOusdMintedForStrategy) < netOusdMintForStrategyThreshold,
            "Attempting to burn too much OUSD."
        );

        // Burn OTokens
        oUSD.burn(msg.sender, _amount);
    }

    /**
     * @notice Allocate unallocated funds on Vault to strategies.
     **/
    function allocate() external virtual whenNotCapitalPaused nonReentrant {
        _allocate();
    }

    /**
     * @dev Allocate unallocated funds on Vault to strategies.
     **/
    function _allocate() internal virtual {
        uint256 vaultValue = _totalValueInVault();
        // Nothing in vault to allocate
        if (vaultValue == 0) return;
        uint256 strategiesValue = _totalValueInStrategies();
        // We have a method that does the same as this, gas optimisation
        uint256 calculatedTotalValue = vaultValue + strategiesValue;

        // We want to maintain a buffer on the Vault so calculate a percentage
        // modifier to multiply each amount being allocated by to enforce the
        // vault buffer
        uint256 vaultBufferModifier;
        if (strategiesValue == 0) {
            // Nothing in Strategies, allocate 100% minus the vault buffer to
            // strategies
            vaultBufferModifier = uint256(1e18) - vaultBuffer;
        } else {
            vaultBufferModifier =
                (vaultBuffer * calculatedTotalValue) /
                vaultValue;
            if (1e18 > vaultBufferModifier) {
                // E.g. 1e18 - (1e17 * 10e18)/5e18 = 8e17
                // (5e18 * 8e17) / 1e18 = 4e18 allocated from Vault
                vaultBufferModifier = uint256(1e18) - vaultBufferModifier;
            } else {
                // We need to let the buffer fill
                return;
            }
        }
        if (vaultBufferModifier == 0) return;

        // Iterate over all assets in the Vault and allocate to the appropriate
        // strategy
        uint256 assetCount = allAssets.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            IERC20 asset = IERC20(allAssets[i]);
            uint256 assetBalance = asset.balanceOf(address(this));
            // No balance, nothing to do here
            if (assetBalance == 0) continue;

            // Multiply the balance by the vault buffer modifier and truncate
            // to the scale of the asset decimals
            uint256 allocateAmount = assetBalance.mulTruncate(
                vaultBufferModifier
            );

            address depositStrategyAddr = assetDefaultStrategies[
                address(asset)
            ];

            if (depositStrategyAddr != address(0) && allocateAmount > 0) {
                IStrategy strategy = IStrategy(depositStrategyAddr);
                // Transfer asset to Strategy and call deposit method to
                // mint or take required action
                asset.safeTransfer(address(strategy), allocateAmount);
                strategy.deposit(address(asset), allocateAmount);
                emit AssetAllocated(
                    address(asset),
                    depositStrategyAddr,
                    allocateAmount
                );
            }
        }
    }

    /**
     * @notice Calculate the total value of assets held by the Vault and all
     *      strategies and update the supply of OTokens.
     */
    function rebase() external virtual nonReentrant {
        _rebase();
    }

    /**
     * @dev Calculate the total value of assets held by the Vault and all
     *      strategies and update the supply of OTokens, optionally sending a
     *      portion of the yield to the trustee.
     * @return totalUnits Total balance of Vault in units
     */
    function _rebase() internal whenNotRebasePaused returns (uint256) {
        uint256 supply = oUSD.totalSupply();
        uint256 vaultValue = _totalValue();
        // If no supply yet, do not rebase
        if (supply == 0) {
            return vaultValue;
        }

        // Calculate yield and new supply
        (uint256 yield, uint256 targetRate) = _nextYield(supply, vaultValue);
        uint256 newSupply = supply + yield;
        // Only rebase upwards and if we have enough backing funds
        if (newSupply <= supply || newSupply > vaultValue) {
            return vaultValue;
        }

        rebasePerSecondTarget = uint64(_min(targetRate, type(uint64).max));
        lastRebase = uint64(block.timestamp); // Intentional cast

        // Fee collection on yield
        address _trusteeAddress = trusteeAddress; // gas savings
        uint256 fee = 0;
        if (_trusteeAddress != address(0)) {
            fee = (yield * trusteeFeeBps) / 1e4;
            if (fee > 0) {
                require(fee < yield, "Fee must not be greater than yield");
                oUSD.mint(_trusteeAddress, fee);
            }
        }
        emit YieldDistribution(_trusteeAddress, yield, fee);

        // Only ratchet OToken supply upwards
        // Final check uses latest totalSupply
        if (newSupply > oUSD.totalSupply()) {
            oUSD.changeSupply(newSupply);
        }
        return vaultValue;
    }

    /**
     * @notice Calculates the amount that would rebase at at next rebase.
     * This is before any fees.
     * @return yield amount of expected yield
     */
    function previewYield() external view returns (uint256 yield) {
        (yield, ) = _nextYield(oUSD.totalSupply(), _totalValue());
        return yield;
    }

    function _nextYield(uint256 supply, uint256 vaultValue)
        internal
        view
        virtual
        returns (uint256 yield, uint256 targetRate)
    {
        uint256 nonRebasing = oUSD.nonRebasingSupply();
        uint256 rebasing = supply - nonRebasing;
        uint256 elapsed = block.timestamp - lastRebase;
        targetRate = rebasePerSecondTarget;

        if (
            elapsed == 0 || // Yield only once per block.
            rebasing == 0 || // No yield if there are no rebasing tokens to give it to.
            supply > vaultValue || // No yield if we do not have yield to give.
            block.timestamp >= type(uint64).max // No yield if we are too far in the future to calculate it correctly.
        ) {
            return (0, targetRate);
        }

        // Start with the full difference available
        yield = vaultValue - supply;

        // Cap via optional automatic duration smoothing
        uint256 _dripDuration = dripDuration;
        if (_dripDuration > 1) {
            // If we are able to sustain an increased drip rate for
            // double the duration, then increase the target drip rate
            targetRate = _max(targetRate, yield / (_dripDuration * 2));
            // If we cannot sustain the target rate any more,
            // then rebase what we can, and reduce the target
            targetRate = _min(targetRate, yield / _dripDuration);
            // drip at the new target rate
            yield = _min(yield, targetRate * elapsed);
        }

        // Cap per second. elapsed is not 1e18 denominated
        yield = _min(yield, (rebasing * elapsed * rebasePerSecondMax) / 1e18);

        // Cap at a hard max per rebase, to avoid long durations resulting in huge rebases
        yield = _min(yield, (rebasing * MAX_REBASE) / 1e18);

        return (yield, targetRate);
    }

    /**
     * @notice Determine the total value of assets held by the vault and its
     *         strategies.
     * @return value Total value in USD/ETH (1e18)
     */
    function totalValue() external view virtual returns (uint256 value) {
        value = _totalValue();
    }

    /**
     * @dev Internal Calculate the total value of the assets held by the
     *         vault and its strategies.
     * @return value Total value in USD/ETH (1e18)
     */
    function _totalValue() internal view virtual returns (uint256 value) {
        return _totalValueInVault() + _totalValueInStrategies();
    }

    /**
     * @dev Internal to calculate total value of all assets held in Vault.
     * @return value Total value in USD/ETH (1e18)
     */
    function _totalValueInVault()
        internal
        view
        virtual
        returns (uint256 value)
    {
        uint256 assetCount = allAssets.length;
        for (uint256 y; y < assetCount; ++y) {
            address assetAddr = allAssets[y];
            uint256 balance = IERC20(assetAddr).balanceOf(address(this));
            if (balance > 0) {
                value += _toUnits(balance, assetAddr);
            }
        }
    }

    /**
     * @dev Internal to calculate total value of all assets held in Strategies.
     * @return value Total value in USD/ETH (1e18)
     */
    function _totalValueInStrategies() internal view returns (uint256 value) {
        uint256 stratCount = allStrategies.length;
        for (uint256 i = 0; i < stratCount; ++i) {
            value = value + _totalValueInStrategy(allStrategies[i]);
        }
    }

    /**
     * @dev Internal to calculate total value of all assets held by strategy.
     * @param _strategyAddr Address of the strategy
     * @return value Total value in USD/ETH (1e18)
     */
    function _totalValueInStrategy(address _strategyAddr)
        internal
        view
        returns (uint256 value)
    {
        IStrategy strategy = IStrategy(_strategyAddr);
        uint256 assetCount = allAssets.length;
        for (uint256 y; y < assetCount; ++y) {
            address assetAddr = allAssets[y];
            if (strategy.supportsAsset(assetAddr)) {
                uint256 balance = strategy.checkBalance(assetAddr);
                if (balance > 0) {
                    value += _toUnits(balance, assetAddr);
                }
            }
        }
    }

    /**
     * @notice Get the balance of an asset held in Vault and all strategies.
     * @param _asset Address of asset
     * @return uint256 Balance of asset in decimals of asset
     */
    function checkBalance(address _asset) external view returns (uint256) {
        return _checkBalance(_asset);
    }

    /**
     * @notice Get the balance of an asset held in Vault and all strategies.
     * @param _asset Address of asset
     * @return balance Balance of asset in decimals of asset
     */
    function _checkBalance(address _asset)
        internal
        view
        virtual
        returns (uint256 balance)
    {
        IERC20 asset = IERC20(_asset);
        balance = asset.balanceOf(address(this));
        uint256 stratCount = allStrategies.length;
        for (uint256 i = 0; i < stratCount; ++i) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            if (strategy.supportsAsset(_asset)) {
                balance = balance + strategy.checkBalance(_asset);
            }
        }
    }

    /**
     * @notice Calculate the outputs for a redeem function, i.e. the mix of
     * coins that will be returned
     */
    function calculateRedeemOutputs(uint256 _amount)
        external
        view
        returns (uint256[] memory)
    {
        return _calculateRedeemOutputs(_amount);
    }

    /**
     * @dev Calculate the outputs for a redeem function, i.e. the mix of
     * coins that will be returned.
     * @return outputs Array of amounts respective to the supported assets
     */
    function _calculateRedeemOutputs(uint256 _amount)
        internal
        view
        virtual
        returns (uint256[] memory outputs)
    {
        // We always give out coins in proportion to how many we have,
        // Now if all coins were the same value, this math would easy,
        // just take the percentage of each coin, and multiply by the
        // value to be given out. But if coins are worth more than $1,
        // then we would end up handing out too many coins. We need to
        // adjust by the total value of coins.
        //
        // To do this, we total up the value of our coins, by their
        // percentages. Then divide what we would otherwise give out by
        // this number.
        //
        // Let say we have 100 DAI at $1.06  and 200 USDT at $1.00.
        // So for every 1 DAI we give out, we'll be handing out 2 USDT
        // Our total output ratio is: 33% * 1.06 + 66% * 1.00 = 1.02
        //
        // So when calculating the output, we take the percentage of
        // each coin, times the desired output value, divided by the
        // totalOutputRatio.
        //
        // For example, withdrawing: 30 OUSD:
        // DAI 33% * 30 / 1.02 = 9.80 DAI
        // USDT = 66 % * 30 / 1.02 = 19.60 USDT
        //
        // Checking these numbers:
        // 9.80 DAI * 1.06 = $10.40
        // 19.60 USDT * 1.00 = $19.60
        //
        // And so the user gets $10.40 + $19.60 = $30 worth of value.

        uint256 assetCount = allAssets.length;
        uint256[] memory assetUnits = new uint256[](assetCount);
        uint256[] memory assetBalances = new uint256[](assetCount);
        outputs = new uint256[](assetCount);

        // Calculate redeem fee
        if (redeemFeeBps > 0) {
            uint256 redeemFee = _amount.mulTruncateScale(redeemFeeBps, 1e4);
            _amount = _amount - redeemFee;
        }

        // Calculate assets balances and decimals once,
        // for a large gas savings.
        uint256 totalUnits = 0;
        for (uint256 i = 0; i < assetCount; ++i) {
            address assetAddr = allAssets[i];
            uint256 balance = _checkBalance(assetAddr);
            assetBalances[i] = balance;
            assetUnits[i] = _toUnits(balance, assetAddr);
            totalUnits = totalUnits + assetUnits[i];
        }
        // Calculate totalOutputRatio
        uint256 totalOutputRatio = 0;
        for (uint256 i = 0; i < assetCount; ++i) {
            uint256 unitPrice = _toUnitPrice(allAssets[i], false);
            uint256 ratio = (assetUnits[i] * unitPrice) / totalUnits;
            totalOutputRatio = totalOutputRatio + ratio;
        }
        // Calculate final outputs
        uint256 factor = _amount.divPrecisely(totalOutputRatio);
        for (uint256 i = 0; i < assetCount; ++i) {
            outputs[i] = (assetBalances[i] * factor) / totalUnits;
        }
    }

    /***************************************
                    Pricing
    ****************************************/

    /**
     * @notice Returns the total price in 18 digit units for a given asset.
     *      Never goes above 1, since that is how we price mints.
     * @param asset address of the asset
     * @return price uint256: unit (USD / ETH) price for 1 unit of the asset, in 18 decimal fixed
     */
    function priceUnitMint(address asset)
        external
        view
        returns (uint256 price)
    {
        /* need to supply 1 asset unit in asset's decimals and can not just hard-code
         * to 1e18 and ignore calling `_toUnits` since we need to consider assets
         * with the exchange rate
         */
        uint256 units = _toUnits(
            uint256(1e18).scaleBy(_getDecimals(asset), 18),
            asset
        );
        price = (_toUnitPrice(asset, true) * units) / 1e18;
    }

    /**
     * @notice Returns the total price in 18 digit unit for a given asset.
     *      Never goes below 1, since that is how we price redeems
     * @param asset Address of the asset
     * @return price uint256: unit (USD / ETH) price for 1 unit of the asset, in 18 decimal fixed
     */
    function priceUnitRedeem(address asset)
        external
        view
        returns (uint256 price)
    {
        /* need to supply 1 asset unit in asset's decimals and can not just hard-code
         * to 1e18 and ignore calling `_toUnits` since we need to consider assets
         * with the exchange rate
         */
        uint256 units = _toUnits(
            uint256(1e18).scaleBy(_getDecimals(asset), 18),
            asset
        );
        price = (_toUnitPrice(asset, false) * units) / 1e18;
    }

    /***************************************
                    Utils
    ****************************************/

    /**
     * @dev Convert a quantity of a token into 1e18 fixed decimal "units"
     * in the underlying base (USD/ETH) used by the vault.
     * Price is not taken into account, only quantity.
     *
     * Examples of this conversion:
     *
     * - 1e18 DAI becomes 1e18 units (same decimals)
     * - 1e6 USDC becomes 1e18 units (decimal conversion)
     * - 1e18 rETH becomes 1.2e18 units (exchange rate conversion)
     *
     * @param _raw Quantity of asset
     * @param _asset Core Asset address
     * @return value 1e18 normalized quantity of units
     */
    function _toUnits(uint256 _raw, address _asset)
        internal
        view
        returns (uint256)
    {
        UnitConversion conversion = assets[_asset].unitConversion;
        if (conversion == UnitConversion.DECIMALS) {
            return _raw.scaleBy(18, _getDecimals(_asset));
        } else if (conversion == UnitConversion.GETEXCHANGERATE) {
            uint256 exchangeRate = IGetExchangeRateToken(_asset)
                .getExchangeRate();
            return (_raw * exchangeRate) / 1e18;
        } else {
            revert("Unsupported conversion type");
        }
    }

    /**
     * @dev Returns asset's unit price accounting for different asset types
     *      and takes into account the context in which that price exists -
     *      - mint or redeem.
     *
     * Note: since we are returning the price of the unit and not the one of the
     * asset (see comment above how 1 rETH exchanges for 1.2 units) we need
     * to make the Oracle price adjustment as well since we are pricing the
     * units and not the assets.
     *
     * The price also snaps to a "full unit price" in case a mint or redeem
     * action would be unfavourable to the protocol.
     *
     */
    function _toUnitPrice(address _asset, bool isMint)
        internal
        view
        returns (uint256 price)
    {
        UnitConversion conversion = assets[_asset].unitConversion;
        price = IOracle(priceProvider).price(_asset);

        if (conversion == UnitConversion.GETEXCHANGERATE) {
            uint256 exchangeRate = IGetExchangeRateToken(_asset)
                .getExchangeRate();
            price = (price * 1e18) / exchangeRate;
        } else if (conversion != UnitConversion.DECIMALS) {
            revert("Unsupported conversion type");
        }

        /* At this stage the price is already adjusted to the unit
         * so the price checks are agnostic to underlying asset being
         * pegged to a USD or to an ETH or having a custom exchange rate.
         */
        require(price <= MAX_UNIT_PRICE_DRIFT, "Vault: Price exceeds max");
        require(price >= MIN_UNIT_PRICE_DRIFT, "Vault: Price under min");

        if (isMint) {
            /* Never price a normalized unit price for more than one
             * unit of OETH/OUSD when minting.
             */
            if (price > 1e18) {
                price = 1e18;
            }
            require(price >= MINT_MINIMUM_UNIT_PRICE, "Asset price below peg");
        } else {
            /* Never give out more than 1 normalized unit amount of assets
             * for one unit of OETH/OUSD when redeeming.
             */
            if (price < 1e18) {
                price = 1e18;
            }
        }
    }

    /**
     * @dev Get the number of decimals of a token asset
     * @param _asset Address of the asset
     * @return decimals number of decimals
     */
    function _getDecimals(address _asset)
        internal
        view
        returns (uint256 decimals)
    {
        decimals = assets[_asset].decimals;
        require(decimals > 0, "Decimals not cached");
    }

    /**
     * @notice Return the number of assets supported by the Vault.
     */
    function getAssetCount() public view returns (uint256) {
        return allAssets.length;
    }

    /**
     * @notice Gets the vault configuration of a supported asset.
     * @param _asset Address of the token asset
     */
    function getAssetConfig(address _asset)
        public
        view
        returns (Asset memory config)
    {
        config = assets[_asset];
    }

    /**
     * @notice Return all vault asset addresses in order
     */
    function getAllAssets() external view returns (address[] memory) {
        return allAssets;
    }

    /**
     * @notice Return the number of strategies active on the Vault.
     */
    function getStrategyCount() external view returns (uint256) {
        return allStrategies.length;
    }

    /**
     * @notice Return the array of all strategies
     */
    function getAllStrategies() external view returns (address[] memory) {
        return allStrategies;
    }

    /**
     * @notice Returns whether the vault supports the asset
     * @param _asset address of the asset
     * @return true if supported
     */
    function isSupportedAsset(address _asset) external view returns (bool) {
        return assets[_asset].isSupported;
    }

    function ADMIN_IMPLEMENTATION() external view returns (address adminImpl) {
        bytes32 slot = adminImplPosition;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            adminImpl := sload(slot)
        }
    }

    /**
     * @dev Falldown to the admin implementation
     * @notice This is a catch all for all functions not declared in core
     */
    // solhint-disable-next-line no-complex-fallback
    fallback() external {
        bytes32 slot = adminImplPosition;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(
                gas(),
                sload(slot),
                0,
                calldatasize(),
                0,
                0
            )

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    function abs(int256 x) private pure returns (uint256) {
        require(x < int256(MAX_INT), "Amount too high");
        return x >= 0 ? uint256(x) : uint256(-x);
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }
}
