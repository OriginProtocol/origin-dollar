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

import "../interfaces/IPriceOracleGetter.sol";
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
        uint256 price;
        uint256 ratio;
        bool supported;
    }
    mapping(address => Asset) assets;
    Asset[] allAssets;

    uint256[] strategyWeights;
    address[] strategies;

    address priceProvider;

    OUSD oUsd;

    function initialize(
        address[] calldata _assets,
        address _priceProvider,
        address _ousd
    ) external initializer {
        oUsd = OUSD(_ousd);

        require(_priceProvider != address(0), "PriceProvider address is zero");
        require(_ousd != address(0), "OUSD address is zero");
        require(_assets.length > 0, "Must initialize with assets");

        priceProvider = _priceProvider;

        for (uint256 i = 0; i < _assets.length; i++) {
            _supportAsset(_assets[i]);
        }
    }

    // CONFIGURATION

    function setPriceProvider(address _priceProvider) external onlyGovernor {
        priceProvider = _priceProvider;
    }

    function supportAsset(address _asset) external onlyGovernor {
        _supportAsset(_asset);
    }

    function _supportAsset(address _asset) internal {
        require(!assets[_asset].supported, "Asset already supported");

        IPriceOracleGetter oracle = IPriceOracleGetter(priceProvider);
        uint256 price = oracle.getAssetPrice(_asset);

        // Get the decimals used by the asset to calculate the ratio between
        // the asset and 18 decimal OUSD
        uint256 assetDecimals = Helpers.getDecimals(_asset);
        uint256 delta = uint256(18).sub(assetDecimals);
        uint256 ratio = uint256(StableMath.getRatioScale()).mul(10**delta);

        assets[_asset] = Asset({
            balance: 0,
            price: price,
            ratio: ratio,
            supported: true
        });

        allAssets.push(assets[_asset]);

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

    function setStrategies(
        uint256[] calldata _weights,
        address[] calldata _platforms
    ) external onlyGovernor {
        _setStrategies(_weights, _platforms);
    }

    function _setStrategies(
        uint256[] memory _weights,
        address[] memory _platforms
    ) internal {}

    // CORE

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
            asset.transferFrom(msg.sender, address(this), _amount),
            "Could not transfer asset to mint OUSD"
        );

        assets[_asset].balance += _amount;

        // Convert amount to OUSD according to ratio (i.e. handle tokens of
        // differing decimals
        uint256 ratioedDeposit = _amount.mulRatioTruncate(assets[_asset].ratio);
        // Calculate amount of OUSD by multiplying by price of asset
        // TODO fix price decimals
        uint256 priceAdjustedDeposit = ratioedDeposit.mul(assets[_asset].price);

        return oUsd.mint(msg.sender, priceAdjustedDeposit);
    }

    /**
     * @notice Calculate total value of the Vault
     */
    function calculateVaultValue() public view returns (uint256 vaultValue) {
        IPriceOracleGetter oracle = IPriceOracleGetter(priceProvider);
        for (uint256 i = 0; i < allAssets.length; i++) {
            assetValue += allAssets[i].balance;
        }
    }

    function depositYield(address _asset, uint256 _amount)
        public
        returns (uint256)
    {
        require(assets[_asset].supported, "Asset is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        IERC20 asset = IERC20(_asset);
        require(
            asset.transferFrom(msg.sender, address(this), _amount),
            "Could not transfer yield"
        );

        uint256 ratioedDeposit = _amount.mulRatioTruncate(assets[_asset].ratio);

        return oUsd.increaseSupply(int256(ratioedDeposit));
    }
}
