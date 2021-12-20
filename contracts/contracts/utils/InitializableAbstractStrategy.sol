// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";

import { Initializable } from "../utils/Initializable.sol";
import { Governable } from "../governance/Governable.sol";

abstract contract InitializableAbstractStrategy is Initializable, Governable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    event PTokenAdded(address indexed _asset, address _pToken);
    event PTokenRemoved(address indexed _asset, address _pToken);
    event Deposit(address indexed _asset, address _pToken, uint256 _amount);
    event Withdrawal(address indexed _asset, address _pToken, uint256 _amount);
    event RewardTokenCollected(address recipient, address rewardToken, uint256 amount);
    event RewardTokenAddressesUpdated(address[] _oldAddresses, address[] _newAddresses);
    event RewardLiquidationThresholdsUpdated(
        uint256[] _oldThreshold,
        uint256[] _newThreshold
    );

    // Core address for the given platform
    address public platformAddress;

    address public vaultAddress;

    // asset => pToken (Platform Specific Token Address)
    mapping(address => address) public assetToPToken;

    // Full list of all assets supported here
    address[] internal assetsMapped;

    // Reward token address
    address[] public rewardTokenAddresses;
    uint256[] public rewardLiquidationThresholds;

    // Reserved for future expansion
    int256[100] private _reserved;

    /**
     * @dev Internal initialize function, to set up initial internal state
     * @param _platformAddress Generic platform address
     * @param _vaultAddress Address of the Vault
     * @param _rewardTokenAddresses Address of reward token for platform
     * @param _assets Addresses of initial supported assets
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address _platformAddress,
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses,
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
    }

    function _initialize(
        address _platformAddress,
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses,
        address[] memory _assets,
        address[] memory _pTokens
    ) internal {
        platformAddress = _platformAddress;
        vaultAddress = _vaultAddress;
        rewardTokenAddresses = _rewardTokenAddresses;
        uint256 assetCount = _assets.length;
        require(assetCount == _pTokens.length, "Invalid input arrays");
        for (uint256 i = 0; i < assetCount; i++) {
            _setPTokenAddress(_assets[i], _pTokens[i]);
        }
        uint256 rewardsCount = _rewardTokenAddresses.length;
        rewardLiquidationThresholds = new uint256[](rewardsCount);
        for (uint256 i = 0; i < rewardsCount; i++) {
            rewardLiquidationThresholds[i] = 0;
        }
    }

    /**
     * @dev Collect accumulated reward token and send to Vault.
     */
    function collectRewardTokens() external virtual onlyVault nonReentrant {
        for (uint256 i = 0; i < rewardTokenAddresses.length; i++) {
            IERC20 rewardToken = IERC20(rewardTokenAddresses[i]);
            uint256 balance = rewardToken.balanceOf(address(this));
            emit RewardTokenCollected(vaultAddress, rewardTokenAddresses[i], balance);
            rewardToken.safeTransfer(vaultAddress, balance);
        }
    }

    /**
     * @dev Verifies that the caller is the Vault.
     */
    modifier onlyVault() {
        require(msg.sender == vaultAddress, "Caller is not the Vault");
        _;
    }

    /**
     * @dev Verifies that the caller is the Vault or Governor.
     */
    modifier onlyVaultOrGovernor() {
        require(
            msg.sender == vaultAddress || msg.sender == governor(),
            "Caller is not the Vault or Governor"
        );
        _;
    }

    /**
     * @dev Set the reward token addresses.
     * @param _rewardTokenAddresses Address array of the reward token
     */
    function setRewardTokenAddresses(address[] calldata _rewardTokenAddresses)
        external
        onlyGovernor
    {
        emit RewardTokenAddressesUpdated(rewardTokenAddresses, _rewardTokenAddresses);
        rewardTokenAddresses = _rewardTokenAddresses;
    }

    /**
     * @dev Get the reward token addresses.
     * @return address[] the reward token addresses.
     */
    function getRewardTokenAddresses() external view returns (address[] memory) {
        return rewardTokenAddresses;
    }

    /**
     * @dev Set the reward token liquidation thresholds.
     * @param _thresholds Threshold array in decimals of reward token that will
     * cause the Vault to claim and withdrawAll on allocate() calls.
     */
    function setRewardLiquidationThresholds(uint256[] calldata _thresholds)
        external
        onlyGovernor
    {
        emit RewardLiquidationThresholdsUpdated(
            rewardLiquidationThresholds,
            _thresholds
        );
        rewardLiquidationThresholds = _thresholds;
    }

    /**
     * @dev Get the reward token liquidation thresholds.
     * @return uint256[] the reward token liquidation thresholds.
     */
    function getRewardLiquidationThresholds() external view returns (uint256[] memory) {
        return rewardLiquidationThresholds;
    }

    /**
     * @dev Provide support for asset by passing its pToken address.
     *      This method can only be called by the system Governor
     * @param _asset    Address for the asset
     * @param _pToken   Address for the corresponding platform token
     */
    function setPTokenAddress(address _asset, address _pToken)
        external
        onlyGovernor
    {
        _setPTokenAddress(_asset, _pToken);
    }

    /**
     * @dev Remove a supported asset by passing its index.
     *      This method can only be called by the system Governor
     * @param _assetIndex Index of the asset to be removed
     */
    function removePToken(uint256 _assetIndex) external onlyGovernor {
        require(_assetIndex < assetsMapped.length, "Invalid index");
        address asset = assetsMapped[_assetIndex];
        address pToken = assetToPToken[asset];

        if (_assetIndex < assetsMapped.length - 1) {
            assetsMapped[_assetIndex] = assetsMapped[assetsMapped.length - 1];
        }
        assetsMapped.pop();
        assetToPToken[asset] = address(0);

        emit PTokenRemoved(asset, pToken);
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

    /***************************************
                 Abstract
    ****************************************/

    function _abstractSetPToken(address _asset, address _pToken)
        internal
        virtual;

    function safeApproveAllTokens() external virtual;

    /**
     * @dev Deposit an amount of asset into the platform
     * @param _asset               Address for the asset
     * @param _amount              Units of asset to deposit
     */
    function deposit(address _asset, uint256 _amount) external virtual;

    /**
     * @dev Deposit balance of all supported assets into the platform
     */
    function depositAll() external virtual;

    /**
     * @dev Withdraw an amount of asset from the platform.
     * @param _recipient         Address to which the asset should be sent
     * @param _asset             Address of the asset
     * @param _amount            Units of asset to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external virtual;

    /**
     * @dev Withdraw all assets from strategy sending assets to Vault.
     */
    function withdrawAll() external virtual;

    /**
     * @dev Get the total asset value held in the platform.
     *      This includes any interest that was generated since depositing.
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        virtual
        returns (uint256 balance);

    /**
     * @dev Check if an asset is supported.
     * @param _asset    Address of the asset
     * @return bool     Whether asset is supported
     */
    function supportsAsset(address _asset) external view virtual returns (bool);
}
