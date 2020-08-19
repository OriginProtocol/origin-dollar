pragma solidity 0.5.17;

import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { Governable } from "../governance/Governable.sol";
import { IPlatformIntegration } from "../interfaces/IPlatformIntegration.sol";

contract InitializableAbstractIntegration is
    Governable,
    Initializable,
    IPlatformIntegration
{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    event PTokenAdded(address indexed _asset, address _pToken);
    event Deposit(address indexed _asset, address _pToken, uint256 _amount);
    event Withdrawal(address indexed _asset, address _pToken, uint256 _amount);

    // Core address for the given platform */
    address public platformAddress;

    // asset => pToken (Platform Specific Token Address)
    mapping(address => address) public assetToPToken;

    // Full list of all assets supported here
    address[] internal assetsMapped;

    /**
     * @dev Internal initialize function, to set up initial internal state
     * @param _platformAddress  Generic platform address
     * @param _assets           Addresses of initial supported assets
     * @param _pTokens          Platform Token corresponding addresses
     */
    function initialize(
        address _platformAddress,
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external initializer {
        InitializableAbstractIntegration._initialize(
            _platformAddress,
            _assets,
            _pTokens
        );
    }

    function _initialize(
        address _platformAddress,
        address[] memory _assets,
        address[] memory _pTokens
    ) internal {
        platformAddress = _platformAddress;

        uint256 assetCount = _assets.length;
        require(assetCount == _pTokens.length, "Invalid input arrays");
        for (uint256 i = 0; i < assetCount; i++) {
            _setPTokenAddress(_assets[i], _pTokens[i]);
        }
    }

    /**
     * @dev Provide support for asset by passing its pToken address.
     *      This method can only be called by the system Governor
     * @param _asset    Address for the asset
     * @param _pToken   Address for the corresponding platform token
     */
    function setPTokenAddress(address _asset, address _pToken) external {
        _setPTokenAddress(_asset, _pToken);
    }

    /**
     * @dev Provide support for asset by passing its pToken address.
     *      Add to internal mappings and execute the platform specific,
     * abstract method `_abstractSetPToken`
     * @param _asset    Address for the asset
     * @param _pToken   Address for the corresponding platform token
     */
    function _setPTokenAddress(address _asset, address _pToken) internal {
        require(assetToPToken[_asset] == address(0), "pToken already set");
        require(
            _asset != address(0) && _pToken != address(0),
            "Invalid addresses"
        );

        assetToPToken[_asset] = _pToken;
        assetsMapped.push(_asset);

        emit PTokenAdded(_asset, _pToken);

        _abstractSetPToken(_asset, _pToken);
    }

    function _abstractSetPToken(address _asset, address _pToken) internal;

    function safeApproveAllTokens() external;

    /**
     * @dev Deposit a amount of asset into the platform
     * @param _asset               Address for the asset
     * @param _amount              Units of asset to deposit
     * @return amountDeposited   Quantity of asset that was deposited
     */
    function deposit(address _asset, uint256 _amount)
        external
        returns (uint256 amountDeposited);

    /**
     * @dev Withdraw a amount of asset from the platform
     * @param _recipient         Address to which the asset should be sent
     * @param _asset             Address of the asset
     * @param _amount            Units of asset to withdraw
     * @return amountWithdrawn   Quantity of asset that was withdrawn
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external returns (uint256 amountWithdrawn);

    /**
     * @dev Get the total asset value held in the platform
     *      This includes any interest that was generated since depositing
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset) external returns (uint256 balance);
}
