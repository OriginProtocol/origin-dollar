pragma solidity 0.5.11;

/*
The Vault contract stores assets. On a deposit, OUSD will be minted and sent to
the depositor. On a withdrawal, OUSD will be burned and assets will be sent to
the withdrawer.

The Vault accepts deposits of interest form yield bearing strategies which will
modify the supply of OUSD.

*/

import "@nomiclabs/buidler/console.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";

import { IStrategy } from "../interfaces/IStrategy.sol";
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";
import {
    InitializableGovernable
} from "../governance/InitializableGovernable.sol";
import { OUSD } from "../token/OUSD.sol";
import "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";

contract Vault is Initializable, InitializableGovernable {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeMath for int256;
    using SafeERC20 for IERC20;

    event AssetSupported(address _asset);
    event AssetDeprecated(address _asset);

    struct Asset {
        uint256 decimals;
        string symbol;
        bool supported;
    }
    mapping(address => Asset) assets;
    address[] allAssets;

    struct Strategy {
        uint256 targetPercent;
        address addr;
    }
    mapping(address => Strategy) strategies;
    address[] allStrategies;

    address priceProvider;

    // Pausing bools
    bool public rebasePaused;
    bool public depositPaused;

    uint256 redeemFeeBps;

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
        redeemFeeBps = 0;
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
     * @param _redeemFeeBps Percentage fee to be charged
     */
    function setRedeemFeeBps(uint256 _redeemFeeBps) external onlyGovernor {
        redeemFeeBps = _redeemFeeBps;
    }

    /**
     * @notice Get the percentage fee to be charged for a redeem.
     */
    function getRedeemFeePercent() public view returns (uint256) {
        return redeemFeeBps;
    }

    /** @notice Add a supported asset to the contract, i.e. one that can be
     *         to mint OUSD.
     * @param _asset Address of asset
     * @param _symbol Asset symbol, e.g. DAI
     */
    function supportAsset(address _asset, string calldata _symbol)
        external
        onlyGovernor
    {
        _supportAsset(_asset, _symbol);
    }

    /** @notice Internal method to add a supported asset to the contract.
     * @param _asset Address of asset
     * @param _symbol Asset symbol, e.g. DAI
     */
    function _supportAsset(address _asset, string memory _symbol) internal {
        require(!assets[_asset].supported, "Asset already supported");

        // Get the decimals used by the asset to calculate the ratio between
        // the asset and 18 decimal oUsd
        uint256 assetDecimals = Helpers.getDecimals(_asset);

        assets[_asset] = Asset({
            supported: true,
            symbol: _symbol,
            decimals: assetDecimals
        });
        allAssets.push(_asset);

        emit AssetSupported(_asset);
    }

    /**
     * @notice Add a strategy to the Vault.
     * @param _addr Address of the strategy to add
     * @param _targetPercent Target percentage of asset allocation to strategy
     */
    function addStrategy(address _addr, uint256 _targetPercent)
        external
        onlyGovernor
    {
        _addStrategy(_addr, _targetPercent);
    }

    /**
     * @notice Internal function to add a strategy to the Vault.
     * @param _addr Address of the strategy
     * @param _targetPercent Target percentage of asset allocation to strategy
     */
    function _addStrategy(address _addr, uint256 _targetPercent) internal {
        require(strategies[_addr].addr == address(0), "Strategy already added");

        strategies[_addr] = Strategy({
            addr: _addr,
            targetPercent: _targetPercent
        });
        allStrategies.push(_addr);
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
        require(assets[_asset].supported, "Asset is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        IERC20 asset = IERC20(_asset);
        require(
            asset.allowance(msg.sender, address(this)) >= _amount,
            "Allowance is not sufficient"
        );

        address strategyAddr = _selectDepositStrategyAddr(_asset);
        if (strategyAddr != address(0)) {
            IStrategy strategy = IStrategy(strategyAddr);
            // safeTransferFrom should throw if either the underlying call
            // returns false (as a standard ERC20 should), or simply throws
            // as USDT does.
            asset.safeTransferFrom(msg.sender, strategyAddr, _amount);
            strategy.deposit(_asset, _amount);
        } else {
            // No strategies, transfer the asset into Vault
            asset.safeTransferFrom(msg.sender, address(this), _amount);
        }

        uint256 priceAdjustedDeposit = _priceUSD(_asset, _amount);
        return oUsd.mint(msg.sender, priceAdjustedDeposit);
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
        require(assets[_asset].supported, "Asset is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        require(
            oUsd.allowance(msg.sender, address(this)) >= _amount,
            "Allowance is not sufficient"
        );

        uint256 feeAdjustedAmount;
        if (redeemFeeBps > 0) {
            uint256 redeemFee = _amount.mul(redeemFeeBps).div(10000);
            feeAdjustedAmount = _amount.sub(redeemFee);
        } else {
            feeAdjustedAmount = _amount;
        }

        // Convert amount to scale of redeeming asset
        uint256 priceAdjustedAmount = _priceUSD(
            _asset,
            feeAdjustedAmount,
            assets[_asset].decimals - 18
        );

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
            revert("Redemption error");
        }

        return oUsd.burn(msg.sender, _amount);
    }

    /**
     * @notice Deposit yield in the form of one of the supported assets.
     *         This will cause a rebase of OUSD.
     * @param _asset Address of the asset
     * @param _amount Amount to deposit
     */
    function depositYield(address _asset, uint256 _amount)
        public
        returns (uint256)
    {
        require(assets[_asset].supported, "Asset is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        IERC20 asset = IERC20(_asset);
        asset.safeTransferFrom(msg.sender, address(this), _amount);

        uint256 ratioedDeposit = _priceUSD(_asset, _amount);
        return oUsd.changeSupply(int256(ratioedDeposit));
    }

    /**
     * @notice Calculate the total value of assets held by the Vault and all
     *         strategies and update the supply of oUsd
     **/
    function rebase() public whenNotRebasePaused returns (uint256) {
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
        value = 0;
        // Get the value of assets in Vault
        for (uint256 y = 0; y < allAssets.length; y++) {
            IERC20 asset = IERC20(allAssets[y]);
            value += _priceUSD(allAssets[y], asset.balanceOf(address(this)));
        }
        // Get the value from strategies
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
    function _strategyPercentDifference(address _strategyAddr)
        internal
        view
        returns (int8 difference)
    {
        difference = int8(
            strategies[_strategyAddr].targetPercent.sub(
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
        int256 maxPercentDifference;

        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            if (strategy.supportsAsset(_asset)) {
                int8 percentDifference = _strategyPercentDifference(
                    allStrategies[i]
                );
                if (percentDifference > maxPercentDifference) {
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
        int256 minPercentDifference;

        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            if (
                strategy.supportsAsset(_asset) &&
                strategy.checkBalance(_asset) > _amount
            ) {
                int8 percentDifference = _strategyPercentDifference(
                    allStrategies[i]
                );
                if (percentDifference > minPercentDifference) {
                    withdrawStrategyAddr = allStrategies[i];
                }
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
        return assets[_asset].supported;
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
        uint256 price = oracle.price(assets[_asset].symbol);
        uint256 amount = _amount.mul(price);
        // Price from Oracle is returned with 6 decimals
        return amount.scaleBy(int8(18 - (6 + assets[_asset].decimals)));
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
        uint256 price = oracle.price(assets[_asset].symbol);
        uint256 amount = _amount.mul(price);
        return amount.scaleBy(int8(_outDecimals - 6));
    }
}
