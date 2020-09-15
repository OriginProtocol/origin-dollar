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
import { IMinMaxOracle } from "../interfaces/IMinMaxOracle.sol";
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
    event Mint(address _addr, uint256 _value);
    event Redeem(address _addr, uint256 _value);
    event StrategyWeightsUpdated(
        address[] _strategyAddresses,
        uint256[] weights
    );
    event DepositsPaused();
    event DepositsUnpaused();

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

    // Address of the Oracle price provider contract
    address public priceProvider;
    // Pausing bools
    bool public rebasePaused;
    bool public depositPaused;
    // Redemption fee in basis points
    uint256 public redeemFeeBps;
    // Buffer of assets to keep in Vault to handle (most) withdrawals
    uint256 public vaultBuffer;

    OUSD oUSD;

    function initialize(address _priceProvider, address _ousd)
        external
        initializer
    {
        require(_priceProvider != address(0), "PriceProvider address is zero");
        require(_ousd != address(0), "oUSD address is zero");

        InitializableGovernable._initialize(msg.sender);

        oUSD = OUSD(_ousd);

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
     * @dev Set address of price provider.
     * @param _priceProvider Address of price provider
     */
    function setPriceProvider(address _priceProvider) external onlyGovernor {
        priceProvider = _priceProvider;
    }

    /**
     * @dev Set a fee in basis points to be charged for a redeem.
     * @param _redeemFeeBps Basis point fee to be charged
     */
    function setRedeemFeeBps(uint256 _redeemFeeBps) external onlyGovernor {
        redeemFeeBps = _redeemFeeBps;
    }

    /**
     * @dev Set a buffer of assets to keep in the Vault to handle most
     * redemptions without needing to spend gas unwinding assets from a Strategy.
     */
    function setVaultBuffer(uint256 _vaultBuffer) external onlyGovernor {
        vaultBuffer = _vaultBuffer;
    }

    /** @dev Add a supported asset to the contract, i.e. one that can be
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
     * @dev Add a strategy to the Vault.
     * @param _addr Address of the strategy to add
     * @param _targetWeight Target percentage of asset allocation to strategy
     */
    function addStrategy(address _addr, uint256 _targetWeight)
        external
        onlyGovernor
    {
        require(!strategies[_addr].isSupported, "Strategy already added");

        strategies[_addr] = Strategy({
            isSupported: true,
            targetWeight: _targetWeight
        });
        allStrategies.push(_addr);

        emit StrategyAdded(_addr);
    }

    /**
     * @dev Remove a strategy from the Vault. Removes all invested assets and
     * returns them to the Vault.
     * @param _addr Address of the strategy to remove
     */

    function removeStrategy(address _addr) external onlyGovernor {
        require(strategies[_addr].isSupported, "Strategy not added");

        // Initialize strategyIndex with out of bounds result so function will
        // revert if no valid index found
        uint256 strategyIndex = allStrategies.length;
        for (uint256 i = 0; i < allStrategies.length; i++) {
            if (allStrategies[i] == _addr) {
                strategyIndex = i;
                break;
            }
        }

        assert(strategyIndex < allStrategies.length);

        allStrategies[strategyIndex] = allStrategies[allStrategies.length - 1];
        allStrategies.length--;

        // Liquidate all assets
        IStrategy strategy = IStrategy(_addr);
        strategy.liquidate();

        emit StrategyRemoved(_addr);
    }

    /**
     * @notice Set the weights for multiple strategies.
     * @param _strategyAddresses Array of strategy addresses
     * @param _weights Array of correpsonding weights
     */
    function setStrategyWeights(
        address[] calldata _strategyAddresses,
        uint256[] calldata _weights
    ) external onlyGovernor {
        require(
            _strategyAddresses.length == _weights.length,
            "Parameter length mismatch"
        );

        for (uint256 i = 0; i < _strategyAddresses.length; i++) {
            strategies[_strategyAddresses[i]].targetWeight = _weights[i];
        }

        emit StrategyWeightsUpdated(_strategyAddresses, _weights);
    }

    /***************************************
                      Core
    ****************************************/

    /**
     * @dev Deposit a supported asset and mint OUSD.
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

        uint256 priceAdjustedDeposit = _priceUSDMin(_asset, _amount);

        oUSD.mint(msg.sender, priceAdjustedDeposit);

        emit Mint(msg.sender, priceAdjustedDeposit);
    }

    /**
     * @dev Mint for multiple assets in the same call.
     * @param _assets Addresses of assets being deposited
     * @param _amounts Amount of each asset at the same index in the _assets
     *                 to deposit.
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
     * @dev Withdraw a supported asset and burn OUSD.
     * @param _amount Amount of OUSD to burn
     */
    function redeem(uint256 _amount) public {
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

        // Calculate redemption outputs
        uint256[] memory outputs = _calculateRedeemOutputs(feeAdjustedAmount);
        // Send outputs
        for (uint256 i = 0; i < allAssets.length; i++) {
            if (outputs[i] == 0) continue;

            address strategyAddr = _selectWithdrawStrategyAddr(
                allAssets[i],
                outputs[i]
            );
            IERC20 asset = IERC20(allAssets[i]);

            if (asset.balanceOf(address(this)) >= outputs[i]) {
                // Use Vault funds first if sufficient
                asset.safeTransfer(msg.sender, outputs[i]);
            } else if (strategyAddr != address(0)) {
                // Nothing in Vault, but something in Strategy, send from there
                IStrategy strategy = IStrategy(strategyAddr);
                strategy.withdraw(msg.sender, allAssets[i], outputs[i]);
            } else {
                // Cant find funds anywhere
                revert("Liquidity error");
            }
        }

        oUSD.burn(msg.sender, _amount);

        // Until we can prove that we won't affect the prices of our assets
        // by withdrawing them, this should be here.
        // It's possible that a strategy was off on it's asset total, perhaps
        // a reward token sold for more or for less than anticipated.
        if (!rebasePaused) {
            rebase();
        }

        emit Redeem(msg.sender, _amount);
    }

    /**
     * @notice Withdraw a supported asset and burn all OUSD.
     */
    function redeemAll() public {
        redeem(oUSD.balanceOf(msg.sender));
    }

    /**
     * @notice Allocate unallocated funds on Vault to strategies.
     * @dev Allocate unallocated funds on Vault to strategies.
     **/
    function allocate() public {
        uint256 vaultValue = _totalValueInVault();
        uint256 strategiesValue = _totalValueInStrategies();
        uint256 totalValue = _totalValue();

        // We want to maintain a buffer on the Vault so calculate a percentage
        // modifier to multiply each amount being allocated by to enforce the
        // vault buffer
        uint256 vaultBufferModifier;
        if (strategiesValue == 0) {
            // Nothing in Strategies, allocate 100% minus the vault buffer to
            // strategies
            vaultBufferModifier = 1e18 - vaultBuffer;
        } else {
            // E.g. 1e18 - (1e17 * 10e18)/5e18 = 8e17
            // (5e18 * 8e17) / 1e18 = 4e18 allocated from Vault
            vaultBufferModifier =
                1e18 -
                vaultBuffer.mul(totalValue).div(
                    vaultValue > 0 ? vaultValue : 1e18
                );
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
     * @dev Calculate the total value of assets held by the Vault and all
     *         strategies and update the supply of oUSD
     */
    function rebase() public whenNotRebasePaused returns (uint256) {
        if (oUSD.totalSupply() == 0) return 0;
        return oUSD.changeSupply(_totalValue());
    }

    /**
     * @dev Determine the total value of assets held by the vault and its
     *         strategies.
     * @return uint256 value Total value in USD (1e18)
     */
    function totalValue() public returns (uint256 value) {
        value = _totalValue();
    }

    /**
     * @dev Internal Calculate the total value of the assets held by the
     *         vault and its strategies.
     * @return uint256 value Total value in USD (1e18)
     */
    function _totalValue() internal returns (uint256 value) {
        return _totalValueInVault() + _totalValueInStrategies();
    }

    /**
     * @dev Internal to calculate total value of all assets held in Vault.
     * @return uint256 Total value in ETH (1e18)
     */
    function _totalValueInVault() internal returns (uint256 value) {
        value = 0;
        for (uint256 y = 0; y < allAssets.length; y++) {
            IERC20 asset = IERC20(allAssets[y]);
            value += _priceUSDMin(allAssets[y], asset.balanceOf(address(this)));
        }
    }

    /**
     * @dev Internal to calculate total value of all assets held in Strategies.
     * @return uint256 Total value in ETH (1e18)
     */
    function _totalValueInStrategies() internal returns (uint256 value) {
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
        returns (uint256 value)
    {
        value = 0;

        IStrategy strategy = IStrategy(_strategyAddr);
        for (uint256 y = 0; y < allAssets.length; y++) {
            if (strategy.supportsAsset(allAssets[y])) {
                value += _priceUSDMin(
                    allAssets[y],
                    strategy.checkBalance(allAssets[y])
                );
            }
        }
    }

    /**
     * @dev Calculate difference in percent of asset allocation for a
               strategy.
     * @param _strategyAddr Address of the strategy
     * @return int8 Difference in percent between current and target
     */
    function _strategyWeightDifference(address _strategyAddr)
        internal
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
    function checkBalance(address _asset) public view returns (uint256) {
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
        public
        returns (uint256[] memory)
    {
        return _calculateRedeemOutputs(_amount);
    }

    /**
     * @notice Calculate the outputs for a redeem function, i.e. the mix of
     * coins that will be returned.
     * returns Array of amounts respective to the supported assets
     */
    function _calculateRedeemOutputs(uint256 _amount)
        internal
        returns (uint256[] memory outputs)
    {
        uint256 totalBalance = _checkBalance();
        uint256 totalOutputValue = 0; // Running total of USD value of assets
        uint256 combinedAssetValue = 0;
        uint256 assetCount = getAssetCount();
        uint256 redeemAssetCount = 0;

        // Initialise arrays
        // Price of each asset in USD in 1e18
        uint256[] memory assetPrices = new uint256[](assetCount);
        uint256[] memory assetDecimals = new uint256[](assetCount);
        outputs = new uint256[](assetCount);

        for (uint256 i = 0; i < allAssets.length; i++) {
            assetDecimals[i] = Helpers.getDecimals(allAssets[i]);
            // Get all the USD prices of the asset in 1e18
            assetPrices[i] = _priceUSDMax(
                allAssets[i],
                uint256(1).scaleBy(int8(assetDecimals[i]))
            );

            // Get the proportional amount of this token for the redeem in 1e18
            uint256 proportionalAmount = _checkBalance(allAssets[i])
                .scaleBy(int8(18 - assetDecimals[i]))
                .mul(_amount)
                .div(totalBalance);

            if (proportionalAmount > 0) {
                // Non zero output means this asset is contributing to the
                // redemption outputs
                redeemAssetCount += 1;
                // Running USD total of the combined value of 1 of each asset in 1e18
                combinedAssetValue += assetPrices[i];
                // Running USD total of all coins in the redeem outputs in 1e18
                totalOutputValue += proportionalAmount.mulTruncate(
                    assetPrices[i]
                );
                // Save the output amount in the decimals of the asset
                outputs[i] = proportionalAmount.scaleBy(
                    int8(assetDecimals[i] - 18)
                );
            }
        }

        // USD difference in amount of coins calculated due to variations in
        // price in 1e18
        int256 outputValueDiff = int256(_amount - totalOutputValue);
        // Make up the difference by adding/removing an equal proportion of
        // each coin according to its USD value
        for (uint256 i = 0; i < outputs.length; i++) {
            if (outputs[i] == 0) continue;

            uint256 adjustment = 0;
            if (outputValueDiff < 0) {
                adjustment = uint256(-outputValueDiff)
                    .divPrecisely(combinedAssetValue)
                    .div(redeemAssetCount)
                    .scaleBy(int8(assetDecimals[i] - 18));
                outputs[i] -= adjustment;
            } else if (outputValueDiff > 0) {
                adjustment = uint256(outputValueDiff)
                    .divPrecisely(combinedAssetValue)
                    .div(redeemAssetCount)
                    .scaleBy(int8(assetDecimals[i] - 18));
                outputs[i] += adjustment;
            }
        }
    }

    /***************************************
                    Pause
    ****************************************/

    /**
     * @dev Set the deposit paused flag to true to prevent rebasing.
     */
    function pauseRebase() external onlyGovernor {
        rebasePaused = true;
    }

    /**
     * @dev Set the deposit paused flag to true to allow rebasing.
     */
    function unpauseRebase() external onlyGovernor {
        rebasePaused = false;
    }

    /**
     * @dev Getter to check the rebase paused flag.
     */
    function isRebasePaused() public view returns (bool) {
        return rebasePaused;
    }

    /**
     * @dev Set the deposit paused flag to true to prevent deposits.
     */
    function pauseDeposits() external onlyGovernor {
        depositPaused = true;

        emit DepositsPaused();
    }

    /**
     * @dev Set the deposit paused flag to false to enable deposits.
     */
    function unpauseDeposits() external onlyGovernor {
        depositPaused = false;

        emit DepositsUnpaused();
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
    function getAllAssets() public view returns (address[] memory) {
        return allAssets;
    }

    /**
     * @dev Return the number of strategies active on the Vault.
     */
    function getStrategyCount() public view returns (uint256) {
        return allStrategies.length;
    }

    /**
     * @dev Get the total APR of the Vault and all Strategies.
     */
    function getAPR() public returns (uint256) {
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
     *      contract, i.e. mistaken sends.
     * @param _asset Address for the asset
     * @param _amount Amount of the asset to transfer
     */
    function transferToken(address _asset, uint256 _amount)
        public
        onlyGovernor
    {
        IERC20(_asset).transfer(governor(), _amount);
    }

    /**
     * @dev Determines if an asset is supported by the vault.
     * @param _asset Address of the asset
     */
    function isSupportedAsset(address _asset) public view returns (bool) {
        return assets[_asset].isSupported;
    }

    /**
     * @dev Returns the total price in 18 digit USD for a given asset using the
     *      min returned for the asset prices and ETH prices from the oracles.
     * @param _asset Address for the asset
     * @param _amount the amount of asset in the asset's decimal precision
     * @return uint256 USD price of the amount of the asset
     */
    function _priceUSDMin(address _asset, uint256 _amount)
        public
        returns (uint256)
    {
        IMinMaxOracle oracle = IMinMaxOracle(priceProvider);
        string memory symbol = Helpers.getSymbol(_asset);
        uint256 p = oracle.priceMin(symbol);
        uint256 amount = _amount.mul(p);
        // Price from Oracle is returned with 8 decimals
        // _amount is in assetDecimals
        uint256 assetDecimals = Helpers.getDecimals(_asset);
        return amount.scaleBy(int8(18 - (8 + assetDecimals)));
    }

    /**
     * @dev Returns the total price in 18 digit USD for a given asset using the
     *      max returned for the asset prices and ETH prices from the oracles.
     * @param _asset Address for the asset
     * @param _amount the amount of asset in the asset's decimal precision
     * @return uint256 USD price of the amount of the asset
     */
    function _priceUSDMax(address _asset, uint256 _amount)
        public
        returns (uint256)
    {
        IMinMaxOracle oracle = IMinMaxOracle(priceProvider);
        string memory symbol = Helpers.getSymbol(_asset);
        uint256 p = oracle.priceMax(symbol);
        uint256 amount = _amount.mul(p);
        // Price from Oracle is returned with 8 decimals
        // _amount is in assetDecimals
        uint256 assetDecimals = Helpers.getDecimals(_asset);
        return amount.scaleBy(int8(18 - (8 + assetDecimals)));
    }

    function _priceUSD(string memory symbol) internal returns (uint256) {
        // Price from Oracle is returned with 8 decimals
        // scale to 18 so 18-8=10
        return IMinMaxOracle(priceProvider).priceMin(symbol).scaleBy(10);
    }

    /**
     * @dev Returns the total price in 18 digit USD for a given asset.
     *      Using Min since min is what we use for mint pricing
     * @param symbol String symbol of the asset
     * @return uint256 USD price of 1 of the asset
     */
    function priceUSD(string calldata symbol) external returns (uint256) {
        return _priceUSD(symbol);
    }

    /**
     * @dev Returns the total price in 18 digit USD for a given asset.
     *      Using Min since min is what we use for mint pricing
     * @param asset Address of the asset
     * @return uint256 USD price of 1 of the asset
     */
    function priceAssetUSD(address asset) external returns (uint256) {
        return _priceUSD(Helpers.getSymbol(asset));
    }
}
