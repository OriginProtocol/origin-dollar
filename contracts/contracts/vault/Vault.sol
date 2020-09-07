pragma solidity 0.5.11;

/*
The Vault contract stores assets. On a deposit, OUSD will be minted and sent to
the depositor. On a withdrawal, OUSD will be burned and assets will be sent to
the withdrawer.

The Vault accepts deposits of interest form yield bearing strategies which will
modify the supply of OUSD.

*/

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
// prettier-ignore
import { Initializable } from "@openzeppelin/upgrades/contracts/Initializable.sol";

import { IStrategy } from "../interfaces/IStrategy.sol";
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";
// prettier-ignore
import { InitializableGovernable } from "../governance/InitializableGovernable.sol";
import { OUSD } from "../token/OUSD.sol";
import "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";

contract Vault is Initializable, InitializableGovernable {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeMath for int256;
    using SafeERC20 for IERC20;

    event AssetSupported(address _asset);
    event StrategyAdded(address _addr);
    event StrategyRemoved(address _addr);

    // Assets supported by the Vault, i.e. Stablecoins
    struct Asset {
        bool isSupported;
    }
    mapping(address => Asset) assets;
    address[] allAssets;

    // Strategies supported by the Vault
    struct Strategy {
        bool isSupported;
        uint256 targetWeight;
    }
    mapping(address => Strategy) strategies;
    address[] allStrategies;

    // Assets transferred during redeem calls will be a mix of stablecoins to
    // conform with target weightings. RedeemOutput is a struct to hold the
    // asset address and amount.
    struct RedeemOutput {
        address asset;
        uint256 amount;
        uint256 price;
    }

    // Address of the Oracle price provider contract
    address priceProvider;

    // Pausing bools
    bool public rebasePaused;
    bool public depositPaused;

    uint256 redeemFeeBps;

    // Buffer of assets to keep in Vault to handle (most) withdrawals
    uint256 vaultBuffer;

    OUSD oUsd;

    function initialize(address _priceProvider, address _ousd)
        external
        initializer
    {
        require(_priceProvider != address(0), "PriceProvider address is zero");
        require(_ousd != address(0), "oUsd address is zero");

        InitializableGovernable._initialize(msg.sender);

        oUsd = OUSD(_ousd);

        priceProvider = _priceProvider;

        rebasePaused = false;
        depositPaused = true;

        // Initial redeem fee of 0 basis points
        redeemFeeBps = 0;
        // Initial Vault buffer of 0%
        vaultBuffer = 0;
    }

    /**
     * @dev Verifies that the rebasing is not paused.
     */
    modifier whenNotRebasePaused() {
        require(!rebasePaused, "Rebasing paused");
        _;
    }

    /***************************************
                 Configuration
    ****************************************/

    /**
     * @notice Set address of price provider.
     * @param _priceProvider Address of price provider
     */
    function setPriceProvider(address _priceProvider) external onlyGovernor {
        priceProvider = _priceProvider;
    }

    /**
     * @notice Set a fee in basis points to be charged for a redeem.
     * @param _redeemFeeBps Basis point fee to be charged
     */
    function setRedeemFeeBps(uint256 _redeemFeeBps) external onlyGovernor {
        redeemFeeBps = _redeemFeeBps;
    }

    /**
     * @notice Get the percentage fee to be charged for a redeem.
     */
    function getRedeemFeeBps() public view returns (uint256) {
        return redeemFeeBps;
    }

    /**
     * @notice Set a buffer of assets to keep in the Vault to handle most
     * redemptions without needing to spend gas unwinding assets from a Strategy.
     */
    function setVaultBuffer(uint256 _vaultBuffer) external onlyGovernor {
        vaultBuffer = _vaultBuffer;
    }

    /** @notice Add a supported asset to the contract, i.e. one that can be
     *         to mint OUSD.
     * @param _asset Address of asset
     */
    function supportAsset(address _asset) external onlyGovernor {
        require(!assets[_asset].isSupported, "Asset already supported");

        assets[_asset] = Asset({ isSupported: true });
        allAssets.push(_asset);

        emit AssetSupported(_asset);
    }

    /**
     * @notice Add a strategy to the Vault.
     * @param _addr Address of the strategy to add
     * @param _targetWeight Target percentage of asset allocation to strategy
     */
    function addStrategy(address _addr, uint256 _targetWeight)
        external
        onlyGovernor
    {
        for (uint256 i = 0; i < allStrategies.length; i++) {
            require(allStrategies[i] != _addr, "Strategy already added");
        }

        strategies[_addr] = Strategy({ targetWeight: _targetWeight });
        allStrategies.push(_addr);

        emit StrategyAdded(_addr);
    }

    /**
     * @notice Remove a strategy from the Vault. Removes all invested assets and
     * returns them to the Vault.
     * @param _addr Address of the strategy to remove
     */

    function removeStrategy(address _addr) external onlyGovernor {
        require(
            strategies[_addr].isSupported != address(0),
            "Strategy not added"
        );

        // Liquidate all assets
        IStrategy strategy = IStrategy(_addr);
        strategy.liquidate();

        uint256 strategyIndex;
        for (uint256 i = 0; i < allStrategies.length; i++) {
            if (allStrategies[i] == _addr) {
                strategyIndex = i;
                break;
            }
        }

        assert(strategyIndex < allStrategies.length);

        allStrategies[strategyIndex] = allStrategies[allStrategies.length - 1];
        allStrategies.length--;

        emit StrategyRemoved(_addr);
    }

    /**
     * @notice Set the weights for multiple strategies.
     * @param _strategyAddresses Array of strategy addresses
     * @param _weights Array of correpsonding weights
     */
    function setStrategyWeights(
        address[] _strategyAddresses,
        uint256[] _weights
    ) external onlyGovernor {
        require(
            _strategyAddresses.length == _weights.length,
            "Parameter length mismatch"
        );

        for (int256 i = 0; i < _strategyAddresses.length; i++) {
            strategies[_strategyAddreesses[i]].weight = _weights[i];
        }
    }

    /***************************************
                      Core
    ****************************************/

    /**
     * @notice Deposit a supported asset and mint OUSD.
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited
     */
    function mint(address _asset, uint256 _amount) public {
        require(!depositPaused, "Deposits are paused");
        require(assets[_asset].isSupported, "Asset is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        if (!rebasePaused) {
            rebase();
        }

        IERC20 asset = IERC20(_asset);
        require(
            asset.allowance(msg.sender, address(this)) >= _amount,
            "Allowance is not sufficient"
        );

        asset.safeTransferFrom(msg.sender, address(this), _amount);

        uint256 priceAdjustedDeposit = _priceUSD(_asset, _amount);
        oUsd.mint(msg.sender, priceAdjustedDeposit);
    }

    /**
     * @notice Mint for multiple assets in the same call.
     */
    function mintMultiple(address[] memory _assets, uint256[] memory _amounts)
        public
    {
        require(_assets.length == _amounts.length, "Parameter length mismatch");
        for (uint256 i = 0; i < _assets.length; i++) {
            mint(_assets[i], _amounts[i]);
        }
    }

    /**
     * @notice Withdraw a supported asset and burn OUSD.
     * @param _asset Address of the asset being withdrawn
     * @param _amount Amount of OUSD to burn
     */
    function redeem(address _asset, uint256 _amount) public {
        require(assets[_asset].isSupported, "Asset is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        if (!rebasePaused) {
            rebase();
        }

        uint256 feeAdjustedAmount;
        if (redeemFeeBps > 0) {
            uint256 redeemFee = _amount.mul(redeemFeeBps).div(10000);
            feeAdjustedAmount = _amount.sub(redeemFee);
        } else {
            feeAdjustedAmount = _amount;
        }

        uint256 assetDecimals = Helpers.getDecimals(_asset);
        // Get the value of 1 of the withdrawing currency
        uint256 assetUSDValue = _priceUSD(
            _asset,
            uint256(1).scaleBy(int8(assetDecimals))
        );
        // Adjust the withdrawal amount by the USD price of the withdrawing
        // asset and scale down to the asset decimals because _amount and the
        // USD value of the asset are in 18 decimals
        uint256 priceAdjustedAmount = feeAdjustedAmount
            .divPrecisely(assetUSDValue)
            .scaleBy(int8(assetDecimals - 18));

        address strategyAddr = _selectWithdrawStrategyAddr(
            _asset,
            priceAdjustedAmount
        );

        IERC20 asset = IERC20(_asset);
        if (asset.balanceOf(address(this)) >= priceAdjustedAmount) {
            // Use Vault funds first if sufficient
            asset.safeTransfer(msg.sender, priceAdjustedAmount);
        } else if (strategyAddr != address(0)) {
            IStrategy strategy = IStrategy(strategyAddr);
            strategy.withdraw(msg.sender, _asset, priceAdjustedAmount);
        } else {
            // Cant find funds anywhere
            revert("Liquidity error");
        }

        oUsd.burn(msg.sender, _amount);

        // Until we can prove that we won't affect the prices of our assets
        // by withdrawing them, this should be here.
        // It's possible that a strategy was off on it's asset total, perhaps
        // a reward token sold for more or for less than anticipated.
        if (!rebasePaused) {
            rebase();
        }
    }

    /**
     * @notice Allocate unallocated funds on Vault to strategies.
     **/
    function allocate() public {
        uint256 vaultValue = _totalValueInVault();
        uint256 strategyValue = _totalValueInStrategies();

        // We want to maintain a buffer on the Vault so calculate a percentage
        // modifier to multiply each amount being allocated by to enforce the
        // vault buffer
        uint256 vaultBufferModifier;
        if (strategyValue == 0) {
            // Nothing in Strategies, modifier should be 100% - buffer
            vaultBufferModifier = 1e18 - vaultBuffer;
        } else {
            // Strategies have assets, proportional to the Vault/Strategy values
            vaultBufferModifier =
                1e18 -
                (vaultValue.divPrecisely(strategyValue)).div(100);
        }

        if (vaultBufferModifier == 0) return;

        // Iterate over all assets in the Vault and allocate the the appropriate
        // strategy
        for (uint256 i = 0; i < allAssets.length; i++) {
            IERC20 asset = IERC20(allAssets[i]);
            uint256 assetBalance = asset.balanceOf(address(this));
            // No balance, nothing to do here
            if (assetBalance == 0) continue;

            uint256 assetDecimals = Helpers.getDecimals(allAssets[i]);
            // Scale down the vault buffer modifier to the same scale as the
            // asset, e.g. 6 decimals would be scaling down by 6 - 18 = -12
            uint256 scaledVaultModifier = vaultBufferModifier.scaleBy(
                int8(assetDecimals - 18)
            );

            // Multiply the balance by the vault buffer modifier and truncate
            // to the scale of the asset decimals
            uint256 allocateAmount = assetBalance.mulTruncateScale(
                scaledVaultModifier,
                10**assetDecimals
            );

            // Get the target Strategy to maintain weightings
            address depositStrategyAddr = _selectDepositStrategyAddr(
                address(asset)
            );

            if (depositStrategyAddr != address(0)) {
                IStrategy strategy = IStrategy(depositStrategyAddr);
                // Transfer asset to Strategy and call deposit method to
                // mint or take required action
                asset.safeTransfer(address(strategy), allocateAmount);
                strategy.deposit(address(asset), allocateAmount);
            }
        }
    }

    /**
     * @notice Calculate the total value of assets held by the Vault and all
     *         strategies and update the supply of oUsd
     **/
    function rebase() public whenNotRebasePaused returns (uint256) {
        if (oUsd.totalSupply() == 0) return 0;
        // If Vault balance has decreased, since last rebase this will result in
        // a negative value which will decrease the total supply of OUSD, if it
        // has increased OUSD total supply will increase
        int256 balanceDelta = int256(_totalValue() - oUsd.totalSupply());
        return oUsd.changeSupply(balanceDelta);
    }

    /**
     * @notice Determine the total value of assets held by the vault and its
     *         strategies.
     */
    function totalValue() public view returns (uint256 value) {
        value = _totalValue();
    }

    /**
     * @notice Internal Calculate the total value of the assets held by the
     *         vault and its strategies.
     * @return uint256 balue Total value in USD (1e18)
     */
    function _totalValue() internal view returns (uint256 value) {
        value = _totalValueInVault() + _totalValueInStrategies();
    }

    /**
     * @notice Internal to calculate total value of all assets held in Vault.
     * @return uint256 Total value in USD (1e18)
     */
    function _totalValueInVault() internal view returns (uint256 value) {
        value = 0;
        for (uint256 y = 0; y < allAssets.length; y++) {
            IERC20 asset = IERC20(allAssets[y]);
            value += _priceUSD(allAssets[y], asset.balanceOf(address(this)));
        }
    }

    /**
     * @notice Internal to calculate total value of all assets held in Strategies.
     * @return uint256 Total value in USD (1e18)
     */
    function _totalValueInStrategies() internal view returns (uint256 value) {
        value = 0;
        for (uint256 i = 0; i < allStrategies.length; i++) {
            value += _totalValueInStrategy(allStrategies[i]);
        }
    }

    /**
     * @notice Internal to calculate total value of all assets held by strategy.
     * @param _strategyAddr Address of the strategy
     * @return uint256 Total value in USD (1e18)
     */
    function _totalValueInStrategy(address _strategyAddr)
        internal
        view
        returns (uint256 value)
    {
        value = 0;

        IStrategy strategy = IStrategy(_strategyAddr);
        for (uint256 y = 0; y < allAssets.length; y++) {
            if (strategy.supportsAsset(allAssets[y])) {
                value += _priceUSD(
                    allAssets[y],
                    strategy.checkBalance(allAssets[y])
                );
            }
        }
    }

    /**
     * @notice Calculate difference in percent of asset allocation for a
               strategy.
     * @param _strategyAddr Address of the strategy
     * @return int8 Difference in percent between current and target
     */
    function _strategyWeightDifference(address _strategyAddr)
        internal
        view
        returns (int8 difference)
    {
        difference = int8(
            strategies[_strategyAddr].targetWeight.sub(
                _totalValueInStrategy(_strategyAddr).div(_totalValue()).mul(100)
            )
        );
    }

    /**
     * @notice Select a strategy for allocating an asset to.
     * @param _asset Address of asset
     * @return address Address of the target strategy
     **/
    function _selectDepositStrategyAddr(address _asset)
        internal
        view
        returns (address depositStrategyAddr)
    {
        depositStrategyAddr = address(0);
        int256 maxDifference;

        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            if (strategy.supportsAsset(_asset)) {
                int8 diff = _strategyWeightDifference(allStrategies[i]);
                if (diff >= maxDifference) {
                    depositStrategyAddr = allStrategies[i];
                }
            }
        }
    }

    /**
     * @notice Select a strategy for withdrawing an asset from.
     * @param _asset Address of asset
     * @return address Address of the target strategy for withdrawal
     **/
    function _selectWithdrawStrategyAddr(address _asset, uint256 _amount)
        internal
        view
        returns (address withdrawStrategyAddr)
    {
        withdrawStrategyAddr = address(0);
        int256 minDifference = 0;

        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            if (
                strategy.supportsAsset(_asset) &&
                strategy.checkBalance(_asset) > _amount
            ) {
                int8 diff = _strategyWeightDifference(allStrategies[i]);
                if (diff >= minDifference) {
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
    function checkBalance(address _asset) public view {
        return _checkBalance(asset);
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
        uint256 balance = asset.balanceOf(address(this));
        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            balance += strategy.checkBalance(_asset);
        }
    }

    /**
     * @notice Get the balance of all assets held in Vault and all strategies.
     * @return uint256 Balance of all assets (1e18)
     */
    function _checkBalance() internal view returns (uint256 balance) {
        uint256 balance = 0;
        for (uint256 i = 0; i < allAssets.length; i++) {
            uint256 assetDecimals = Helpers.getDecimals(_asset);
            balance += checkBalance(allAsset[i]).scaleBy(
                int8(assetDecimals - 18)
            );
        }
    }

    /**
     * @notice Calculate the outputs for a redeem function, i.e. the mix of
     * coins that will be returned
     */
    function calculateRedeemOutputs(uint256 _amount) public {
        return _calculateRedeemOutputs();
    }

    /**
     * @notice Calculate the outputs for a redeem function, i.e. the mix of
     * coins that will be returned.
     * returns Struct containing asset address and the amount
     */
    function _calculateRedeemOutputs(uint256 _amount)
        internal
        view
        returns (RedeemOutput[] outputs)
    {
        uint256 totalBalance = checkBalance();
        uint256 totalOutpuValue = 0;

        RedeemOutput[] outputs;
        for (uint256 i = 0; i < allAssets.length; i++) {
            uint256 assetDecimals = Helpers.getDecimals(_asset);
            // Get the balance of the asset and convert to 1e18
            uint256 assetBalance = _checkBalance(allAssets[i]).scaleBy(
                int8(assetDecimals - 18)
            );
            // Get the proportion of this coin for the redeem
            uint256 redeemProportion = assetBalance.mul(_amount).div(
                totalBalance
            );
            // Get the value of 1 of the withdrawing currency
            uint256 assetUSDValue = _priceUSD(
                _asset,
                uint256(1).scaleBy(int8(assetDecimals))
            );
            totalOutputValue += redeemProportion.divPrecisely(assetUSDValue);
            outputs.push(
                RedeemOutput(allAssets[i], redeemProportion, assetUSDValue)
            );
        }

        // USD difference due to variations in price (1e18)
        int256 outputDiff = int256(_amount.sub(totalOutputValue));
        if (outputDiff > 0) {
            // Make up the difference by adding/removing an equal proportion of
            // each coin according to its USD value
            uint256 assetCount = getAssetCount();
            for (uint256 i = 0; i < outputs.length; i++) {
                outputs[i].amount += (outputDiff.div(assetCount)).divPrecisely(
                    output.price
                );
            }
        }
    }

    /***************************************
                    Pause
    ****************************************/

    /**
     * @notice Set the deposit paused flag to true to prevent rebasing.
     */
    function pauseRebase() external onlyGovernor {
        rebasePaused = true;
    }

    /**
     * @notice Set the deposit paused flag to true to allow rebasing.
     */
    function unpauseRebase() external onlyGovernor {
        rebasePaused = false;
    }

    /**
     * @notice Getter to check the rebase paused flag.
     */
    function isRebasePaused() public view returns (bool) {
        return rebasePaused;
    }

    /**
     * @notice Set the deposit paused flag to true to prevent deposits.
     */
    function pauseDeposits() external onlyGovernor {
        depositPaused = true;
    }

    /**
     * @notice Set the deposit paused flag to false to enable deposits.
     */
    function unpauseDeposits() external onlyGovernor {
        depositPaused = false;
    }

    /**
     * @notice Getter to check deposit paused flag.
     */
    function isDepositPaused() public view returns (bool) {
        return depositPaused;
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
     * @dev Return the number of strategies active on the Vault.
     */
    function getStrategyCount() public view returns (uint256) {
        return allStrategies.length;
    }

    /**
     * @dev Get APR
     */
    function getAPR() public view returns (uint256) {
        if (getStrategyCount() == 0) return 0;
        uint256 totalAPR = 0;
        // Get the value from strategies
        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            if (strategy.getAPR() > 0) {
                totalAPR += _totalValueInStrategy(allStrategies[i])
                    .divPrecisely(_totalValue())
                    .mulTruncate(strategy.getAPR());
            }
        }
        return totalAPR;
    }

    /**
     * @dev Transfer token to governor. Intended for recovering tokens stuck in
     *      strategy contracts, i.e. mistaken sends.
     * @param _asset Address for the asset
     * @param _amount Amount of the asset to transfer
     */
    function transferToken(address _asset, uint256 _amount)
        public
        onlyGovernor
    {
        IERC20(_asset).safeTransfer(governor(), _amount);
    }

    /**
     * @dev Determines if an asset is supported by the vault.
     * @param _asset Address of the asset
     */
    function isSupportedAsset(address _asset) public view returns (bool) {
        return assets[_asset].isSupported;
    }

    /**
     * @dev Returns the total price in 18 digit USD for a given asset.
     *
     */
    function _priceUSD(address _asset, uint256 _amount)
        public
        view
        returns (uint256)
    {
        IPriceOracle oracle = IPriceOracle(priceProvider);
        string memory symbol = Helpers.getSymbol(_asset);
        uint256 price = oracle.price(symbol);
        uint256 amount = _amount.mul(price);
        // Price from Oracle is returned with 6 decimals
        uint256 assetDecimals = Helpers.getDecimals(_asset);
        return amount.scaleBy(int8(18 - (6 + assetDecimals)));
    }

    /**
     * @dev Returns the total price in USD converting from one scale to another.
     *
     */
    function _priceUSD(
        address _asset,
        uint256 _amount,
        uint256 _outDecimals
    ) public view returns (uint256) {
        IPriceOracle oracle = IPriceOracle(priceProvider);
        string memory symbol = Helpers.getSymbol(_asset);
        uint256 price = oracle.price(symbol);
        uint256 amount = _amount.mul(price);
        return amount.scaleBy(int8(_outDecimals - 6));
    }
}
