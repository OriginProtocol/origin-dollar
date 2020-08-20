pragma solidity 0.5.17;

/*
The Vault contract stores assets. On a deposit, OUSD will be minted and sent to
the depositor. On a withdrawal, OUSD will be burned and assets will be sent to
the withdrawer.

The Vault accepts deposits of interest form yield bearing strategies which will
modify the supply of OUSD.

*/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "../interfaces/IStrategy.sol";
import "../interfaces/IPriceOracle.sol";
import "../governance/Governable.sol";
import "../token/OUSD.sol";
import "../utils/Helpers.sol";
import "../utils/StableMath.sol";

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

    OUSD oUsd;

    function initialize(address _priceProvider, address _ousd)
        external
        initializer
    {
        oUsd = OUSD(_ousd);

        require(_priceProvider != address(0), "PriceProvider address is zero");
        require(_ousd != address(0), "OUSD address is zero");

        priceProvider = _priceProvider;
    }

    /***************************************
              CONFIGURATION
    ****************************************/

    /** @notice Set address of price provider
     * @param _priceProvider Address of price provider
     */
    function setPriceProvider(address _priceProvider) external onlyGovernor {
        priceProvider = _priceProvider;
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
        // the asset and 18 decimal OUSD
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
     * of the asset and withdraw the asset from all platforms.
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

    /***************************************
              CORE
    ****************************************/

    /**
     * @notice Deposit a supported asset and mint OUSD
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited
     */
    function depositAndMint(address _asset, uint256 _amount) public {
        require(assets[_asset].supported, "Asset is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        IERC20 asset = IERC20(_asset);
        require(
            asset.allowance(msg.sender, address(this)) >= _amount,
            "Allowance is not sufficient"
        );

        if (allStrategies.length > 0) {
            address strategyAddr = _selectStrategyAddr(_asset, _amount);
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

        uint256 priceAdjustedDeposit = _priceUSD(_amount, _asset);
        return oUsd.mint(msg.sender, priceAdjustedDeposit);
    }

    // TODO this is a mock non-implimentation
    function withdrawAndBurn(address _asset, uint256 _amount) external {
        oUsd.burn(msg.sender, _amount);
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

        uint256 ratioedDeposit = _priceUSD(_amount, _asset);

        return oUsd.changeSupply(int256(ratioedDeposit));
    }

    /**
     * @notice Select a strategy for allocating an asset to.
     * @param _asset Address of asset
     * @param _amount Amount of asset
     **/
    function _selectStrategyAddr(address _asset, uint256 _amount)
        internal
        returns (address)
    {
        // TODO Implement strategy selection
        //      - Does the strategy support the asset?
        //      - How to allocate according to weightings
        //      - Handling failures
        return allStrategies[0];
    }

    /***************************************
                    UTILS
    ****************************************/

    /**
     * @dev Returns the total price in 18 digit USD for a given asset.
     *
     */
    function _priceUSD(uint256 _quantity, address _asset)
        public
        view
        returns (uint256)
    {
        IPriceOracle oracle = IPriceOracle(priceProvider);
        uint256 price = oracle.price(assets[_asset].symbol);
        uint256 amount = _quantity.mul(price);
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
