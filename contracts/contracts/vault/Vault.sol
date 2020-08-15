pragma solidity 0.5.17;

/*
The Vault contract stores assets. On a deposit, OUSD will be minted and sent to
the depositor. On a withdrawal, OUSD will be burned and assets will be sent to
the withdrawer.

The Vault accepts deposits of interest form yield bearing strategies which will
modify the supply of OUSD.

*/

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";

import {InitializableModule} from "../utils/InitializableModule.sol";
import {IPriceOracleGetter} from "../interfaces/IPriceOracleGetter.sol";
import {Helpers} from "../utils/Helpers.sol";
import {OUSD} from "../token/OUSD.sol";
import {StableMath} from "../utils/StableMath.sol";

contract Vault is Initializable, InitializableModule {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    event AssetSupported(address __asset);

    struct Asset {
        uint256 totalBalance;
        uint256 price;
        uint256 ratio;
        bool supported;
    }

    mapping(address => Asset) assets;
    IERC20[] allAssets;

    OUSD oUsd;

    function initialize(
        address[] calldata _assets,
        address _kernel,
        address _ousd
    ) external initializer {
        oUsd = OUSD(_ousd);
        InitializableModule._initialize(_kernel);

        require(_ousd != address(0), "OUSD address is zero");
        require(_assets.length > 0, "Must initialize with assets");

        for (uint256 i = 0; i < _assets.length; i++) {
            _supportAsset(_assets[i]);
        }
    }

    function supportAsset(address _asset) external {
        _supportAsset(_asset);
    }

    function _supportAsset(address _asset) internal {
        require(!assets[_asset].supported, "Asset already supported");

        IPriceOracleGetter oracle = IPriceOracleGetter(_priceProvider());
        uint256 price = oracle.getAssetPrice(_asset);

        // Get the decimals used by the asset to calculate the ratio between
        // the asset and 18 decimal OUSD
        uint256 assetDecimals = Helpers.getDecimals(_asset);
        uint256 delta = uint256(18).sub(assetDecimals);
        uint256 ratio = uint256(StableMath.getRatioScale()).mul(10**delta);

        assets[_asset] = Asset({
            totalBalance: 0,
            price: price,
            ratio: ratio,
            supported: true
        });

        allAssets.push(IERC20(_asset));

        emit AssetSupported(_asset);
    }

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

        uint256 ratioedDeposit = _amount.mulRatioTruncate(assets[_asset].ratio);

        return oUsd.mint(msg.sender, ratioedDeposit);
    }

    /**
    function calculateAssetValue() {
        IPriceOracleGetter oracle = IPriceOracleGetter(addressesProvider.getPriceOracle());
        for (uint256 i = 0; i < allAssets.length; i++) {
        }
    }
    */

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
