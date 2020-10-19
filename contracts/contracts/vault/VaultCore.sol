pragma solidity 0.5.11;

/**
 * @title OUSD Vault Contract
 * @notice The Vault contract stores assets. On a deposit, OUSD will be minted
           and sent to the depositor. On a withdrawal, OUSD will be burned and
           assets will be sent to the withdrawer. The Vault accepts deposits of
           interest form yield bearing strategies which will modify the supply
           of OUSD.
 * @author Origin Protocol Inc
 */

import "./VaultStorage.sol";
import { IMinMaxOracle } from "../interfaces/IMinMaxOracle.sol";
import { IRebaseHooks } from "../interfaces/IRebaseHooks.sol";

contract VaultCore is VaultStorage {
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
    modifier whenNotDepositPaused() {
        require(!depositPaused, "Deposits paused");
        _;
    }

    /**
     * @dev Deposit a supported asset and mint OUSD.
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited
     */
    function mint(address _asset, uint256 _amount)
        external
        whenNotDepositPaused
    {
        require(assets[_asset].isSupported, "Asset is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        uint256 price = IMinMaxOracle(priceProvider).priceMin(
            Helpers.getSymbol(_asset)
        );
        if (price > 1e8) {
            price = 1e8;
        }
        uint256 priceAdjustedDeposit = _amount.mulTruncateScale(
            price.scaleBy(int8(10)), // 18-8 because oracles have 8 decimals precision
            10**Helpers.getDecimals(_asset)
        );

        // Rebase must happen before any transfers occur.
        if (priceAdjustedDeposit > rebaseThreshold && !rebasePaused) {
            rebase(true);
        }

        // Transfer the deposited coins to the vault
        IERC20 asset = IERC20(_asset);
        asset.safeTransferFrom(msg.sender, address(this), _amount);

        // Mint matching OUSD
        oUSD.mint(msg.sender, priceAdjustedDeposit);
        emit Mint(msg.sender, priceAdjustedDeposit);

        if (priceAdjustedDeposit >= autoAllocateThreshold) {
            allocate();
        }
    }

    /**
     * @dev Mint for multiple assets in the same call.
     * @param _assets Addresses of assets being deposited
     * @param _amounts Amount of each asset at the same index in the _assets
     *                 to deposit.
     */
    function mintMultiple(
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external whenNotDepositPaused {
        require(_assets.length == _amounts.length, "Parameter length mismatch");

        uint256 priceAdjustedTotal = 0;
        uint256[] memory assetPrices = _getAssetPrices(false);
        for (uint256 i = 0; i < allAssets.length; i++) {
            for (uint256 j = 0; j < _assets.length; j++) {
                if (_assets[j] == allAssets[i]) {
                    if (_amounts[j] > 0) {
                        uint256 assetDecimals = Helpers.getDecimals(
                            allAssets[i]
                        );
                        uint256 price = assetPrices[i];
                        if (price > 1e18) {
                            price = 1e18;
                        }
                        priceAdjustedTotal += _amounts[j].mulTruncateScale(
                            price,
                            10**assetDecimals
                        );
                    }
                }
            }
        }
        // Rebase must happen before any transfers occur.
        if (priceAdjustedTotal > rebaseThreshold && !rebasePaused) {
            rebase(true);
        }

        for (uint256 i = 0; i < _assets.length; i++) {
            IERC20 asset = IERC20(_assets[i]);
            asset.safeTransferFrom(msg.sender, address(this), _amounts[i]);
        }

        oUSD.mint(msg.sender, priceAdjustedTotal);
        emit Mint(msg.sender, priceAdjustedTotal);

        if (priceAdjustedTotal >= autoAllocateThreshold) {
            allocate();
        }
    }

    /**
     * @dev Withdraw a supported asset and burn OUSD.
     * @param _amount Amount of OUSD to burn
     */
    function redeem(uint256 _amount) public {
        if (_amount > rebaseThreshold && !rebasePaused) {
            rebase(false);
        }
        _redeem(_amount);
    }

    function _redeem(uint256 _amount) internal {
        require(_amount > 0, "Amount must be greater than 0");

        // Calculate redemption outputs
        uint256[] memory outputs = _calculateRedeemOutputs(_amount);
        // Send outputs
        for (uint256 i = 0; i < allAssets.length; i++) {
            if (outputs[i] == 0) continue;

            IERC20 asset = IERC20(allAssets[i]);

            if (asset.balanceOf(address(this)) >= outputs[i]) {
                // Use Vault funds first if sufficient
                asset.safeTransfer(msg.sender, outputs[i]);
            } else {
                address strategyAddr = _selectWithdrawStrategyAddr(
                    allAssets[i],
                    outputs[i]
                );

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

        oUSD.burn(msg.sender, _amount);

        // Until we can prove that we won't affect the prices of our assets
        // by withdrawing them, this should be here.
        // It's possible that a strategy was off on its asset total, perhaps
        // a reward token sold for more or for less than anticipated.
        if (_amount > rebaseThreshold && !rebasePaused) {
            rebase(true);
        }

        emit Redeem(msg.sender, _amount);
    }

    /**
     * @notice Withdraw a supported asset and burn all OUSD.
     */
    function redeemAll() external {
        //unfortunately we have to do balanceOf twice
        if (oUSD.balanceOf(msg.sender) > rebaseThreshold && !rebasePaused) {
            rebase(false);
        }
        _redeem(oUSD.balanceOf(msg.sender));
    }

    /**
     * @notice Allocate unallocated funds on Vault to strategies.
     * @dev Allocate unallocated funds on Vault to strategies.
     **/
    function allocate() public {
        _allocate();
    }

    /**
     * @notice Allocate unallocated funds on Vault to strategies.
     * @dev Allocate unallocated funds on Vault to strategies.
     **/
    function _allocate() internal {
        uint256 vaultValue = _totalValueInVault();
        // Nothing in vault to allocate
        if (vaultValue == 0) return;
        uint256 strategiesValue = _totalValueInStrategies();
        // We have a method that does the same as this, gas optimisation
        uint256 totalValue = vaultValue + strategiesValue;

        // We want to maintain a buffer on the Vault so calculate a percentage
        // modifier to multiply each amount being allocated by to enforce the
        // vault buffer
        uint256 vaultBufferModifier;
        if (strategiesValue == 0) {
            // Nothing in Strategies, allocate 100% minus the vault buffer to
            // strategies
            vaultBufferModifier = 1e18 - vaultBuffer;
        } else {
            vaultBufferModifier = vaultBuffer.mul(totalValue).div(vaultValue);
            if (1e18 > vaultBufferModifier) {
                // E.g. 1e18 - (1e17 * 10e18)/5e18 = 8e17
                // (5e18 * 8e17) / 1e18 = 4e18 allocated from Vault
                vaultBufferModifier = 1e18 - vaultBufferModifier;
            } else {
                // We need to let the buffer fill
                return;
            }
        }
        if (vaultBufferModifier == 0) return;

        // Iterate over all assets in the Vault and allocate the the appropriate
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

            // Get the target Strategy to maintain weightings
            address depositStrategyAddr = _selectDepositStrategyAddr(
                address(asset)
            );

            if (depositStrategyAddr != address(0) && allocateAmount > 0) {
                IStrategy strategy = IStrategy(depositStrategyAddr);
                // Transfer asset to Strategy and call deposit method to
                // mint or take required action
                asset.safeTransfer(address(strategy), allocateAmount);
                strategy.deposit(address(asset), allocateAmount);
            }
        }
    }

    /**
     * @dev Calculate the total value of assets held by the Vault and all
     *         strategies and update the supply of oUSD
     */
    function rebase() public whenNotRebasePaused returns (uint256) {
        rebase(true);
    }

    /**
     * @dev Calculate the total value of assets held by the Vault and all
     *         strategies and update the supply of oUSD
     */
    function rebase(bool sync) internal whenNotRebasePaused returns (uint256) {
        if (oUSD.totalSupply() == 0) return 0;
        uint256 oldTotalSupply = oUSD.totalSupply();
        uint256 newTotalSupply = _totalValue();
        // Only rachet upwards
        if (newTotalSupply > oldTotalSupply) {
            oUSD.changeSupply(newTotalSupply);
            if (rebaseHooksAddr != address(0)) {
                IRebaseHooks(rebaseHooksAddr).postRebase(sync);
            }
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
        return _totalValueInVault() + _totalValueInStrategies();
    }

    /**
     * @dev Internal to calculate total value of all assets held in Vault.
     * @return uint256 Total value in ETH (1e18)
     */
    function _totalValueInVault() internal view returns (uint256 value) {
        value = 0;
        for (uint256 y = 0; y < allAssets.length; y++) {
            IERC20 asset = IERC20(allAssets[y]);
            uint256 assetDecimals = Helpers.getDecimals(allAssets[y]);
            uint256 balance = asset.balanceOf(address(this));
            if (balance > 0) {
                value += balance.scaleBy(int8(18 - assetDecimals));
            }
        }
    }

    /**
     * @dev Internal to calculate total value of all assets held in Strategies.
     * @return uint256 Total value in ETH (1e18)
     */
    function _totalValueInStrategies() internal view returns (uint256 value) {
        value = 0;
        for (uint256 i = 0; i < allStrategies.length; i++) {
            value += _totalValueInStrategy(allStrategies[i]);
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
        value = 0;
        IStrategy strategy = IStrategy(_strategyAddr);
        for (uint256 y = 0; y < allAssets.length; y++) {
            uint256 assetDecimals = Helpers.getDecimals(allAssets[y]);
            if (strategy.supportsAsset(allAssets[y])) {
                uint256 balance = strategy.checkBalance(allAssets[y]);
                if (balance > 0) {
                    value += balance.scaleBy(int8(18 - assetDecimals));
                }
            }
        }
    }

    /**
     * @dev Calculate difference in percent of asset allocation for a
               strategy.
     * @param _strategyAddr Address of the strategy
     * @return int256 Difference between current and target. 18 decimals. For ex. 10%=1e17.
     */
    function _strategyWeightDifference(address _strategyAddr)
        internal
        view
        returns (int256 difference)
    {
        difference =
            int256(strategies[_strategyAddr].targetWeight) -
            int256(
                _totalValueInStrategy(_strategyAddr).divPrecisely(_totalValue())
            );
    }

    /**
     * @dev Select a strategy for allocating an asset to.
     * @param _asset Address of asset
     * @return address Address of the target strategy
     */
    function _selectDepositStrategyAddr(address _asset)
        internal
        view
        returns (address depositStrategyAddr)
    {
        depositStrategyAddr = address(0);
        int256 maxDifference = 0;
        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            if (strategy.supportsAsset(_asset)) {
                int256 diff = _strategyWeightDifference(allStrategies[i]);
                if (diff >= maxDifference) {
                    maxDifference = diff;
                    depositStrategyAddr = allStrategies[i];
                }
            }
        }
    }

    /**
     * @dev Select a strategy for withdrawing an asset from.
     * @param _asset Address of asset
     * @return address Address of the target strategy for withdrawal
     */
    function _selectWithdrawStrategyAddr(address _asset, uint256 _amount)
        internal
        view
        returns (address withdrawStrategyAddr)
    {
        withdrawStrategyAddr = address(0);
        int256 minDifference = 1e18;

        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            if (
                strategy.supportsAsset(_asset) &&
                strategy.checkBalance(_asset) > _amount
            ) {
                int256 diff = _strategyWeightDifference(allStrategies[i]);
                if (diff <= minDifference) {
                    minDifference = diff;
                    withdrawStrategyAddr = allStrategies[i];
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
                balance += strategy.checkBalance(_asset);
            }
        }
    }

    /**
     * @notice Get the balance of all assets held in Vault and all strategies.
     * @return uint256 Balance of all assets (1e18)
     */
    function _checkBalance() internal view returns (uint256 balance) {
        balance = 0;
        for (uint256 i = 0; i < allAssets.length; i++) {
            uint256 assetDecimals = Helpers.getDecimals(allAssets[i]);
            balance += _checkBalance(allAssets[i]).scaleBy(
                int8(18 - assetDecimals)
            );
        }
    }

    /**
     * @notice Calculate the outputs for a redeem function, i.e. the mix of
     * coins that will be returned
     */
    function calculateRedeemOutputs(uint256 _amount)
        external
        returns (uint256[] memory)
    {
        return _calculateRedeemOutputs(_amount);
    }

    /**
     * @notice Calculate the outputs for a redeem function, i.e. the mix of
     * coins that will be returned.
     * @return Array of amounts respective to the supported assets
     */
    function _calculateRedeemOutputs(uint256 _amount)
        internal
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

        uint256 assetCount = getAssetCount();
        uint256[] memory assetPrices = _getAssetPrices(true);
        uint256[] memory assetBalances = new uint256[](assetCount);
        uint256[] memory assetDecimals = new uint256[](assetCount);
        uint256 totalBalance = 0;
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
            totalBalance += balance.scaleBy(int8(18 - decimals));
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
            totalOutputRatio += ratio;
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
        returns (uint256[] memory assetPrices)
    {
        assetPrices = new uint256[](getAssetCount());

        IMinMaxOracle oracle = IMinMaxOracle(priceProvider);
        // Price from Oracle is returned with 8 decimals
        // _amount is in assetDecimals

        for (uint256 i = 0; i < allAssets.length; i++) {
            string memory symbol = Helpers.getSymbol(allAssets[i]);
            // Get all the USD prices of the asset in 1e18
            if (useMax) {
                assetPrices[i] = oracle.priceMax(symbol).scaleBy(int8(18 - 8));
            } else {
                assetPrices[i] = oracle.priceMin(symbol).scaleBy(int8(18 - 8));
            }
        }
    }

    /***************************************
                    Utils
    ****************************************/

    /**
     * @dev Return the number of assets suppported by the Vault.
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
    function getStrategyCount() public view returns (uint256) {
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
