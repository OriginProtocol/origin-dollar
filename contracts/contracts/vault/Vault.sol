pragma solidity 0.5.17;

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
import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";

import { IStrategy } from "../interfaces/IStrategy.sol";
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";
import { Governable } from "../governance/Governable.sol";
import { OUSD } from "../token/OUSD.sol";
import "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";

contract Vault is Initializable, Governable {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    event AssetSupported(address _asset);
    event AssetDeprecated(address _asset);

    struct Asset {
        uint256 balance;
        uint256 decimals;
        string symbol;
        bool supported;
    }
    mapping(address => Asset) assets;
    address[] allAssets;

    struct Strategy {
        uint8 weight;
        address addr;
    }
    mapping(address => Strategy) strategies;
    address[] allStrategies;

    address priceProvider;

    bool rebasePaused;
    bool public depositPaused;

    OUSD oUsd;

    function initialize(address _priceProvider, address _ousd)
        external
        initializer
    {
        require(_priceProvider != address(0), "PriceProvider address is zero");
        require(_ousd != address(0), "oUsd address is zero");

        oUsd = OUSD(_ousd);

        priceProvider = _priceProvider;

        rebasePaused = false;
        depositPaused = true;
    }

    /**
     * @dev Verifies that the rebasing is not paused.
     */
    modifier whenNotRebasePaused() {
        require(!rebasePaused, "Rebasing paused");
        _;
    }

    /**
     * @dev Verifies that the caller is the OUSD contract.
     */
    modifier onlyOusd() {
        require(msg.sender == address(oUsd), "Caller is not OUSD");
        _;
    }

    /***************************************
           Configuration and Governance
    ****************************************/

    /**
     * @notice Set address of price provider
     * @param _priceProvider Address of price provider
     */
    function setPriceProvider(address _priceProvider) external onlyGovernor {
        priceProvider = _priceProvider;
    }

    /**
     * @notice Add a supported asset to the contract, i.e. one that can be
     *         to mint oUsd.
     * @param _asset Address of asset
     * @param _symbol Asset symbol, e.g. DAI
     */
    function supportAsset(address _asset, string calldata _symbol)
        external
        onlyGovernor
    {
        _supportAsset(_asset, _symbol);
    }

    /**
     * @notice Internal method to add a supported asset to the contract.
     * @param _asset Address of asset
     * @param _symbol Asset symbol, e.g. DAI
     */
    function _supportAsset(address _asset, string memory _symbol) internal {
        require(!assets[_asset].supported, "Asset already supported");

        // Get the decimals used by the asset to calculate the ratio between
        // the asset and 18 decimal oUsd
        uint256 assetDecimals = Helpers.getDecimals(_asset);

        assets[_asset] = Asset({
            balance: 0,
            supported: true,
            symbol: _symbol,
            decimals: assetDecimals
        });
        allAssets.push(_asset);

        emit AssetSupported(_asset);
    }

    /**
     * @notice Remove support for an asset. This will prevent future deposits
     *         of the asset and withdraw the asset from all platforms.
     * @param _asset Address of the asset being deprecated
     */
    function deprecateAsset(address _asset) external onlyGovernor {
        require(assets[_asset].supported, "Asset not supported");

        assets[_asset].supported = false;

        // TODO remove from allAssets
        // TODO withdraw from all platforms
        // TODO what happens with withdrawals?

        emit AssetDeprecated(_asset);
    }

    /**
     *
     *
     */
    function addStrategy(address _addr, uint8 _weight) external onlyGovernor {
        _addStrategy(_addr, _weight);
    }

    /**
     *
     *
     */
    function _addStrategy(address _addr, uint8 _weight) internal {
        strategies[_addr] = Strategy({ addr: _addr, weight: _weight });
        allStrategies.push(_addr);
    }

    /**
     *
     *
     */
    function setRebasePaused(bool _rebasePaused) external onlyGovernor {
        rebasePaused = _rebasePaused;
    }

    /**
     * @notice Calculate the total value of assets held by the Vault and all
     *         strategies and update the supply of oUsd
     */
    function rebase()
        public
        onlyGovernor
        whenNotRebasePaused
        returns (uint256)
    {
        // If Vault balance has decreased, since last rebase this will result in
        // a negative value which will decrease the total supply of OUSD, if it
        // has increased OUSD total supply will increase
        int256 balanceDelta = int256(_totalValue() - oUsd.totalSupply());
        return oUsd.changeSupply(balanceDelta);
    }

    /***************************************
                      Core
    ****************************************/

    /**
     * @notice Allocate an asset to a strategy
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited
     */
    function allocateAsset(address _asset, uint256 _amount) external onlyOusd {
        IERC20 asset = IERC20(_asset);
        if (allStrategies.length > 0) {
            address strategyAddr = _selectDepositStrategyAddr(_asset, _amount);
            IStrategy strategy = IStrategy(strategyAddr);
            // safeTransferFrom should throw if either the underlying call
            // returns false (as a standard ERC20 should), or simply throws
            // as USDT does.
            asset.safeTransfer(strategyAddr, _amount);
            strategy.deposit(_asset, _amount);
        } else {
            // No strategies, keep the asset into Vault
            asset.safeTransfer(address(this), _amount);
            assets[_asset].balance += _amount;
        }
    }

    /**
     * @notice Withdraw an asset from a strategy and approve the OUSD contract
     *         to move it.
     * @param _recipient Recipient of the asset
     * @param _asset Address of the asset being withdrawn
     * @param _amount Amount of OUSD to withdraw in asset equivalent
     */
    function withdrawAsset(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external onlyOusd returns (uint256 withdrawalAmount) {
        // Get asset out of strategy
        if (allStrategies.length > 0) {
            address strategyAddr = _selectWithdrawStrategyAddr(_asset, _amount);
            IStrategy strategy = IStrategy(strategyAddr);
            strategy.withdraw(address(this), _asset, _amount);
        }

        // TODO fix the USD calculation
        withdrawalAmount = _amount;

        IERC20 asset = IERC20(_asset);
        asset.safeTransfer(_recipient, withdrawalAmount);
    }

    /**
     * @notice Deposit yield in the form of one of the supported assets.
     *         This will cause a rebase of OUSD.
     * @param _asset Address of the asset
     * @param _amount Amount to deposit
     **/
    function depositYield(address _asset, uint256 _amount)
        public
        returns (uint256)
    {
        require(assets[_asset].supported, "Asset is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        IERC20 asset = IERC20(_asset);
        asset.safeTransferFrom(msg.sender, address(this), _amount);

        uint256 ratioedDeposit = priceUSD(_asset, _amount);
        return oUsd.changeSupply(int256(ratioedDeposit));
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
        for (uint256 y = 0; y < allAssets.length; y++) {
            value += priceUSD(allAssets[y], assets[allAssets[y]].balance);
            // Get the balance form all strategies for this asset
            for (uint256 i = 0; i < allStrategies.length; i++) {
                IStrategy strategy = IStrategy(allStrategies[i]);
                if (strategy.supportsAsset(allAssets[y])) {
                    value += priceUSD(
                        allAssets[y],
                        strategy.checkBalance(allAssets[y])
                    );
                }
            }
        }
    }

    /**
     * @notice Select a strategy for allocating an asset to.
     * @param _asset Address of asset
     * @param _amount Amount of asset
     **/
    function _selectDepositStrategyAddr(address _asset, uint256 _amount)
        internal
        returns (address)
    {
        // TODO Implement strategy selection
        //      - Does the strategy support the asset?
        //      - How to allocate according to weightings
        //      - Handling failures
        return allStrategies[0];
    }

    /**
     * @notice Select a strategy for withdrawing an asset from.
     * @param _asset Address of asset
     * @param _amount Amount of asset
     **/
    function _selectWithdrawStrategyAddr(address _asset, uint256 _amount)
        internal
        returns (address)
    {
        return allStrategies[0];
    }

    /***************************************
                    Pause
    ****************************************/

    /**
     * @notice Prevent new deposits by setting the deposit paused flag.
     */
    function pauseDeposits() external onlyGovernor {
        depositPaused = true;
    }

    /**
     * @notice Allow new deposits by setting the deposit paused flag.
     */
    function unpauseDeposits() external onlyGovernor {
        depositPaused = false;
    }

    /**
     * @notice Getter to check deposit paused flag.
     */
    function isDepositPaused() public view returns (bool) {
        return depositPaused == true;
    }

    /***************************************
                    Utils
    ****************************************/

    /**
     * @dev Determines if an asset is supported by the vault.
     * @param _asset Address of the asset
     */
    function isSupportedAsset(address _asset) public returns (bool) {
        return assets[_asset].supported == true;
    }

    /**
     * @dev Returns the total price in 18 digit USD for a given asset.
     * @param _asset Address of the asset
     * @param _amount Amount of the asset to determine price of
     * @return uint256 Value in USD (1e18)
     */
    function priceUSD(address _asset, uint256 _amount)
        public
        view
        returns (uint256)
    {
        IPriceOracle oracle = IPriceOracle(priceProvider);
        uint256 price = oracle.price(assets[_asset].symbol);
        uint256 amount = _amount.mul(price);
        return _toFullScale(amount, 6 + assets[_asset].decimals);
    }

    /**
     * @dev adjust the incoming number so that it has 18 decimals.
     * Works for both numbers larger and smaller than the 18 decimals.
     * TODO move to StableMath.sol
     */
    function _toFullScale(uint256 x, uint256 inDecimals)
        internal
        pure
        returns (uint256)
    {
        int256 adjust = 18 - int256(inDecimals);
        if (adjust > 0) {
            x = x.mul(10**uint256(adjust));
        } else if (adjust < 0) {
            x = x.div(10**uint256(adjust * -1));
        }
        return x;
    }
}
