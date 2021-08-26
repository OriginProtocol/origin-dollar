pragma solidity 0.5.11;

/**
 * @title OUSD Vault Contract
 * @notice The Vault contract stores assets. On a deposit, OUSD will be minted
           and sent to the depositor. On a withdrawal, OUSD will be burned and
           assets will be sent to the withdrawer. The Vault accepts deposits of
           interest from yield bearing strategies which will modify the supply
           of OUSD.
 * @author Origin Protocol Inc
 */

import "./VaultStorage.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IBuyback } from "../interfaces/IBuyback.sol";

contract VaultCore is VaultStorage {
    uint256 constant MAX_UINT =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

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
     * @dev Deposit a supported asset and mint OUSD.
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited
     * @param _minimumOusdAmount Minimum OUSD to mint
     */
    function mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumOusdAmount
    ) external whenNotCapitalPaused nonReentrant {
        require(assets[_asset].isSupported, "Asset is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        uint256 price = IOracle(priceProvider).price(_asset);
        if (price > 1e8) {
            price = 1e8;
        }
        uint256 assetDecimals = Helpers.getDecimals(_asset);
        uint256 unitAdjustedDeposit = _amount.scaleBy(int8(18 - assetDecimals));
        uint256 priceAdjustedDeposit = _amount.mulTruncateScale(
            price.scaleBy(int8(10)), // 18-8 because oracles have 8 decimals precision
            10**assetDecimals
        );

        if (_minimumOusdAmount > 0) {
            require(
                priceAdjustedDeposit >= _minimumOusdAmount,
                "Mint amount lower than minimum"
            );
        }

        emit Mint(msg.sender, priceAdjustedDeposit);

        // Rebase must happen before any transfers occur.
        if (unitAdjustedDeposit >= rebaseThreshold && !rebasePaused) {
            _rebase();
        }

        // Mint matching OUSD
        oUSD.mint(msg.sender, priceAdjustedDeposit);

        // Transfer the deposited coins to the vault
        IERC20 asset = IERC20(_asset);
        asset.safeTransferFrom(msg.sender, address(this), _amount);

        if (unitAdjustedDeposit >= autoAllocateThreshold) {
            _allocate();
        }
    }

    /**
     * @dev Mint for multiple assets in the same call.
     * @param _assets Addresses of assets being deposited
     * @param _amounts Amount of each asset at the same index in the _assets
     *                 to deposit.
     * @param _minimumOusdAmount Minimum OUSD to mint
     */
    function mintMultiple(
        address[] calldata _assets,
        uint256[] calldata _amounts,
        uint256 _minimumOusdAmount
    ) external whenNotCapitalPaused nonReentrant {
        require(_assets.length == _amounts.length, "Parameter length mismatch");

        uint256 unitAdjustedTotal = 0;
        uint256 priceAdjustedTotal = 0;
        uint256[] memory assetPrices = _getAssetPrices(false);
        for (uint256 j = 0; j < _assets.length; j++) {
            // In memoriam
            require(assets[_assets[j]].isSupported, "Asset is not supported");
            require(_amounts[j] > 0, "Amount must be greater than 0");
            for (uint256 i = 0; i < allAssets.length; i++) {
                if (_assets[j] == allAssets[i]) {
                    uint256 assetDecimals = Helpers.getDecimals(allAssets[i]);
                    uint256 price = assetPrices[i];
                    if (price > 1e18) {
                        price = 1e18;
                    }
                    unitAdjustedTotal = unitAdjustedTotal.add(
                        _amounts[j].scaleBy(int8(18 - assetDecimals))
                    );
                    priceAdjustedTotal = priceAdjustedTotal.add(
                        _amounts[j].mulTruncateScale(price, 10**assetDecimals)
                    );
                }
            }
        }

        if (_minimumOusdAmount > 0) {
            require(
                priceAdjustedTotal >= _minimumOusdAmount,
                "Mint amount lower than minimum"
            );
        }

        emit Mint(msg.sender, priceAdjustedTotal);

        // Rebase must happen before any transfers occur.
        if (unitAdjustedTotal >= rebaseThreshold && !rebasePaused) {
            _rebase();
        }

        oUSD.mint(msg.sender, priceAdjustedTotal);

        for (uint256 i = 0; i < _assets.length; i++) {
            IERC20 asset = IERC20(_assets[i]);
            asset.safeTransferFrom(msg.sender, address(this), _amounts[i]);
        }

        if (unitAdjustedTotal >= autoAllocateThreshold) {
            _allocate();
        }
    }

    /**
     * @dev Withdraw a supported asset and burn OUSD.
     * @param _amount Amount of OUSD to burn
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
     * @dev Withdraw a supported asset and burn OUSD.
     * @param _amount Amount of OUSD to burn
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function _redeem(uint256 _amount, uint256 _minimumUnitAmount) internal {
        require(_amount > 0, "Amount must be greater than 0");

        // Calculate redemption outputs
        (
            uint256[] memory outputs,
            uint256 _backingValue
        ) = _calculateRedeemOutputs(_amount);

        // Check that OUSD is backed by enough assets
        uint256 _totalSupply = oUSD.totalSupply();
        if (maxSupplyDiff > 0) {
            // Allow a max difference of maxSupplyDiff% between
            // backing assets value and OUSD total supply
            uint256 diff = _totalSupply.divPrecisely(_backingValue);
            require(
                (diff > 1e18 ? diff.sub(1e18) : uint256(1e18).sub(diff)) <=
                    maxSupplyDiff,
                "Backing supply liquidity error"
            );
        }

        emit Redeem(msg.sender, _amount);

        // Send outputs
        for (uint256 i = 0; i < allAssets.length; i++) {
            if (outputs[i] == 0) continue;

            IERC20 asset = IERC20(allAssets[i]);

            if (asset.balanceOf(address(this)) >= outputs[i]) {
                // Use Vault funds first if sufficient
                asset.safeTransfer(msg.sender, outputs[i]);
            } else {
                address strategyAddr = assetDefaultStrategies[allAssets[i]];
                if (strategyAddr != address(0)) {
                    // Nothing in Vault, but something in Strategy, send from there
                    IStrategy strategy = IStrategy(strategyAddr);
                    strategy.withdraw(msg.sender, allAssets[i], outputs[i]);
                } else {
                    // Cant find funds anywhere
                    revert("Liquidity error");
                }
            }
        }

        if (_minimumUnitAmount > 0) {
            uint256 unitTotal = 0;
            for (uint256 i = 0; i < outputs.length; i++) {
                uint256 assetDecimals = Helpers.getDecimals(allAssets[i]);
                unitTotal = unitTotal.add(
                    outputs[i].scaleBy(int8(18 - assetDecimals))
                );
            }
            require(
                unitTotal >= _minimumUnitAmount,
                "Redeem amount lower than minimum"
            );
        }

        oUSD.burn(msg.sender, _amount);

        // Until we can prove that we won't affect the prices of our assets
        // by withdrawing them, this should be here.
        // It's possible that a strategy was off on its asset total, perhaps
        // a reward token sold for more or for less than anticipated.
        if (_amount > rebaseThreshold && !rebasePaused) {
            _rebase();
        }
    }

    /**
     * @notice Withdraw a supported asset and burn all OUSD.
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function redeemAll(uint256 _minimumUnitAmount)
        external
        whenNotCapitalPaused
        nonReentrant
    {
        _redeem(oUSD.balanceOf(msg.sender), _minimumUnitAmount);
    }

    /**
     * @notice Allocate unallocated funds on Vault to strategies.
     * @dev Allocate unallocated funds on Vault to strategies.
     **/
    function allocate() external whenNotCapitalPaused nonReentrant {
        _allocate();
    }

    /**
     * @notice Allocate unallocated funds on Vault to strategies.
     * @dev Allocate unallocated funds on Vault to strategies.
     **/
    function _allocate() internal {
        // Harvest for all reward tokens above reward liquidation threshold.
        // Harvesting is the first action that takes place so we have an up to
        // date picture of total assets before allocating to strategies.
        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            address rewardTokenAddress = strategy.rewardTokenAddress();
            if (rewardTokenAddress != address(0)) {
                uint256 liquidationThreshold = strategy
                    .rewardLiquidationThreshold();
                if (liquidationThreshold == 0) {
                    // No threshold set, always harvest from strategy
                    IVault(address(this)).harvest(allStrategies[i]);
                } else {
                    // Check balance against liquidation threshold
                    // Note some strategies don't hold the reward token balance
                    // on their contract so the liquidation threshold should be
                    // set to 0
                    IERC20 rewardToken = IERC20(rewardTokenAddress);
                    uint256 rewardTokenAmount = rewardToken.balanceOf(
                        allStrategies[i]
                    );
                    if (rewardTokenAmount >= liquidationThreshold) {
                        IVault(address(this)).harvest(allStrategies[i]);
                    }
                }
            }
        }

        uint256 vaultValue = _totalValueInVault();
        // Nothing in vault to allocate
        if (vaultValue == 0) return;
        uint256 strategiesValue = _totalValueInStrategies();
        // We have a method that does the same as this, gas optimisation
        uint256 calculatedTotalValue = vaultValue.add(strategiesValue);

        // We want to maintain a buffer on the Vault so calculate a percentage
        // modifier to multiply each amount being allocated by to enforce the
        // vault buffer
        uint256 vaultBufferModifier;
        if (strategiesValue == 0) {
            // Nothing in Strategies, allocate 100% minus the vault buffer to
            // strategies
            vaultBufferModifier = uint256(1e18).sub(vaultBuffer);
        } else {
            vaultBufferModifier = vaultBuffer.mul(calculatedTotalValue).div(
                vaultValue
            );
            if (1e18 > vaultBufferModifier) {
                // E.g. 1e18 - (1e17 * 10e18)/5e18 = 8e17
                // (5e18 * 8e17) / 1e18 = 4e18 allocated from Vault
                vaultBufferModifier = uint256(1e18).sub(vaultBufferModifier);
            } else {
                // We need to let the buffer fill
                return;
            }
        }
        if (vaultBufferModifier == 0) return;

        // Iterate over all assets in the Vault and allocate to the appropriate
        // strategy
        for (uint256 i = 0; i < allAssets.length; i++) {
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

        // Trigger OGN Buyback
        address _trusteeAddress = trusteeAddress; // gas savings
        if (_trusteeAddress != address(0)) {
            IBuyback(trusteeAddress).swap();
        }
    }

    /**
     * @dev Calculate the total value of assets held by the Vault and all
     *      strategies and update the supply of OUSD.
     */
    function rebase() external nonReentrant {
        _rebase();
    }

    /**
     * @dev Calculate the total value of assets held by the Vault and all
     *      strategies and update the supply of OUSD, optionally sending a
     *      portion of the yield to the trustee.
     */
    function _rebase() internal whenNotRebasePaused {
        uint256 ousdSupply = oUSD.totalSupply();
        if (ousdSupply == 0) {
            return;
        }
        uint256 vaultValue = _totalValue();

        // Yield fee collection
        address _trusteeAddress = trusteeAddress; // gas savings
        if (_trusteeAddress != address(0) && (vaultValue > ousdSupply)) {
            uint256 yield = vaultValue.sub(ousdSupply);
            uint256 fee = yield.mul(trusteeFeeBps).div(10000);
            require(yield > fee, "Fee must not be greater than yield");
            if (fee > 0) {
                oUSD.mint(_trusteeAddress, fee);
            }
            emit YieldDistribution(_trusteeAddress, yield, fee);
        }

        // Only rachet OUSD supply upwards
        ousdSupply = oUSD.totalSupply(); // Final check should use latest value
        if (vaultValue > ousdSupply) {
            oUSD.changeSupply(vaultValue);
        }
    }

    /**
     * @dev Determine the total value of assets held by the vault and its
     *         strategies.
     * @return uint256 value Total value in USD (1e18)
     */
    function totalValue() external view returns (uint256 value) {
        value = _totalValue();
    }

    /**
     * @dev Internal Calculate the total value of the assets held by the
     *         vault and its strategies.
     * @return uint256 value Total value in USD (1e18)
     */
    function _totalValue() internal view returns (uint256 value) {
        return _totalValueInVault().add(_totalValueInStrategies());
    }

    /**
     * @dev Internal to calculate total value of all assets held in Vault.
     * @return uint256 Total value in ETH (1e18)
     */
    function _totalValueInVault() internal view returns (uint256 value) {
        for (uint256 y = 0; y < allAssets.length; y++) {
            IERC20 asset = IERC20(allAssets[y]);
            uint256 assetDecimals = Helpers.getDecimals(allAssets[y]);
            uint256 balance = asset.balanceOf(address(this));
            if (balance > 0) {
                value = value.add(balance.scaleBy(int8(18 - assetDecimals)));
            }
        }
    }

    /**
     * @dev Internal to calculate total value of all assets held in Strategies.
     * @return uint256 Total value in ETH (1e18)
     */
    function _totalValueInStrategies() internal view returns (uint256 value) {
        for (uint256 i = 0; i < allStrategies.length; i++) {
            value = value.add(_totalValueInStrategy(allStrategies[i]));
        }
    }

    /**
     * @dev Internal to calculate total value of all assets held by strategy.
     * @param _strategyAddr Address of the strategy
     * @return uint256 Total value in ETH (1e18)
     */
    function _totalValueInStrategy(address _strategyAddr)
        internal
        view
        returns (uint256 value)
    {
        IStrategy strategy = IStrategy(_strategyAddr);
        for (uint256 y = 0; y < allAssets.length; y++) {
            uint256 assetDecimals = Helpers.getDecimals(allAssets[y]);
            if (strategy.supportsAsset(allAssets[y])) {
                uint256 balance = strategy.checkBalance(allAssets[y]);
                if (balance > 0) {
                    value = value.add(
                        balance.scaleBy(int8(18 - assetDecimals))
                    );
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
     * @return uint256 Balance of asset in decimals of asset
     */
    function _checkBalance(address _asset)
        internal
        view
        returns (uint256 balance)
    {
        IERC20 asset = IERC20(_asset);
        balance = asset.balanceOf(address(this));
        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            if (strategy.supportsAsset(_asset)) {
                balance = balance.add(strategy.checkBalance(_asset));
            }
        }
    }

    /**
     * @notice Get the balance of all assets held in Vault and all strategies.
     * @return uint256 Balance of all assets (1e18)
     */
    function _checkBalance() internal view returns (uint256 balance) {
        for (uint256 i = 0; i < allAssets.length; i++) {
            uint256 assetDecimals = Helpers.getDecimals(allAssets[i]);
            balance = balance.add(
                _checkBalance(allAssets[i]).scaleBy(int8(18 - assetDecimals))
            );
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
        (uint256[] memory outputs, ) = _calculateRedeemOutputs(_amount);
        return outputs;
    }

    /**
     * @notice Calculate the outputs for a redeem function, i.e. the mix of
     * coins that will be returned.
     * @return Array of amounts respective to the supported assets
     */
    function _calculateRedeemOutputs(uint256 _amount)
        internal
        view
        returns (uint256[] memory outputs, uint256 totalBalance)
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

        uint256 assetCount = getAssetCount();
        uint256[] memory assetPrices = _getAssetPrices(true);
        uint256[] memory assetBalances = new uint256[](assetCount);
        uint256[] memory assetDecimals = new uint256[](assetCount);
        uint256 totalOutputRatio = 0;
        outputs = new uint256[](assetCount);

        // Calculate redeem fee
        if (redeemFeeBps > 0) {
            uint256 redeemFee = _amount.mul(redeemFeeBps).div(10000);
            _amount = _amount.sub(redeemFee);
        }

        // Calculate assets balances and decimals once,
        // for a large gas savings.
        for (uint256 i = 0; i < allAssets.length; i++) {
            uint256 balance = _checkBalance(allAssets[i]);
            uint256 decimals = Helpers.getDecimals(allAssets[i]);
            assetBalances[i] = balance;
            assetDecimals[i] = decimals;
            totalBalance = totalBalance.add(
                balance.scaleBy(int8(18 - decimals))
            );
        }
        // Calculate totalOutputRatio
        for (uint256 i = 0; i < allAssets.length; i++) {
            uint256 price = assetPrices[i];
            // Never give out more than one
            // stablecoin per dollar of OUSD
            if (price < 1e18) {
                price = 1e18;
            }
            uint256 ratio = assetBalances[i]
                .scaleBy(int8(18 - assetDecimals[i]))
                .mul(price)
                .div(totalBalance);
            totalOutputRatio = totalOutputRatio.add(ratio);
        }
        // Calculate final outputs
        uint256 factor = _amount.divPrecisely(totalOutputRatio);
        for (uint256 i = 0; i < allAssets.length; i++) {
            outputs[i] = assetBalances[i].mul(factor).div(totalBalance);
        }
    }

    /**
     * @notice Get an array of the supported asset prices in USD.
     * @return uint256[] Array of asset prices in USD (1e18)
     */
    function _getAssetPrices(bool useMax)
        internal
        view
        returns (uint256[] memory assetPrices)
    {
        assetPrices = new uint256[](getAssetCount());

        IOracle oracle = IOracle(priceProvider);
        // Price from Oracle is returned with 8 decimals
        // _amount is in assetDecimals
        for (uint256 i = 0; i < allAssets.length; i++) {
            assetPrices[i] = oracle.price(allAssets[i]).scaleBy(int8(18 - 8));
        }
    }

    /***************************************
                    Utils
    ****************************************/

    /**
     * @dev Return the number of assets supported by the Vault.
     */
    function getAssetCount() public view returns (uint256) {
        return allAssets.length;
    }

    /**
     * @dev Return all asset addresses in order
     */
    function getAllAssets() external view returns (address[] memory) {
        return allAssets;
    }

    /**
     * @dev Return the number of strategies active on the Vault.
     */
    function getStrategyCount() external view returns (uint256) {
        return allStrategies.length;
    }

    function isSupportedAsset(address _asset) external view returns (bool) {
        return assets[_asset].isSupported;
    }

    /**
     * @dev Falldown to the admin implementation
     * @notice This is a catch all for all functions not declared in core
     */
    function() external payable {
        bytes32 slot = adminImplPosition;
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize)

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas, sload(slot), 0, calldatasize, 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize)

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize)
            }
            default {
                return(0, returndatasize)
            }
        }
    }
}
