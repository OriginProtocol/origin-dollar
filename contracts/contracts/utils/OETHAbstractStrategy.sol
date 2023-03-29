// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Initializable } from "../utils/Initializable.sol";
import { Governable } from "../governance/Governable.sol";
import { IVault } from "../interfaces/IVault.sol";

abstract contract InitializableAbstractStrategy is Initializable, Governable {
    using SafeERC20 for IERC20;

    /* Applies to Deposit & Withdrawal events. Lengths _assets & _amounts array will always
     * match while _platformTokens array can be shorter. e.g. with Curve strategy multiple
     * assets can be deployed in order to receive one LP token.
     */
    event Deposit(address[] _assets, address[] _platformTokens, uint256[] _amounts);
    event Withdrawal(address[] _assets, address[] _platformTokens, uint256[] _amounts);
    event RewardTokenCollected(
        address recipient,
        address indexed rewardToken,
        uint256 amount
    );
    event RewardTokenAddressesUpdated(
        address[] _oldAddresses,
        address[] _newAddresses
    );
    event PlatformTokenAddressesUpdated(
        address[] _oldAddresses,
        address[] _newAddresses
    );
    event AssetSupportedAddressesUpdated(
        address[] _oldAddresses,
        address[] _newAddresses
    );
    event HarvesterAddressUpdated(
        address _oldHarvesterAddress,
        address _newHarvesterAddress
    );

    address public vaultAddress;

    // Full list of all assets supported here
    address[] internal assetsSupported;

    // Full list of all platform tokens here
    address[] internal platformTokens;

    // Address of the one address allowed to collect reward tokens
    address public harvesterAddress;

    // Reward token addresses
    address[] public rewardTokenAddresses;
    // Reserved for future expansion
    int256[100] private _reserved;

    /**
     * @dev Internal initialize function, to set up initial internal state
     * @param _vaultAddress Address of the Vault
     * @param _rewardTokenAddresses Address of reward token for platform
     * @param _assets Addresses of initial supported assets
     * @param _platformTokens Platform Token corresponding addresses
     */
    function initialize(
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses,
        address[] calldata _assets,
        address[] calldata _platformTokens
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _platformTokens
        );
    }

    function _initialize(
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses,
        address[] calldata _assets,
        address[] calldata _platformTokens
    ) internal {
        vaultAddress = _vaultAddress;
        rewardTokenAddresses = _rewardTokenAddresses;
        platformTokens = _platformTokens;
        assetsSupported = _assets;
    }

    /**
     * @dev Collect accumulated reward token and send to Vault.
     */
    function collectRewardTokens() external virtual onlyHarvester nonReentrant {
        _collectRewardTokens();
    }

    function _collectRewardTokens() internal {
        for (uint256 i = 0; i < rewardTokenAddresses.length; i++) {
            IERC20 rewardToken = IERC20(rewardTokenAddresses[i]);
            uint256 balance = rewardToken.balanceOf(address(this));
            emit RewardTokenCollected(
                harvesterAddress,
                rewardTokenAddresses[i],
                balance
            );
            rewardToken.safeTransfer(harvesterAddress, balance);
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
     * @dev Verifies that the caller is the Harvester.
     */
    modifier onlyHarvester() {
        require(msg.sender == harvesterAddress, "Caller is not the Harvester");
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
     * @dev Verifies that the caller is the Vault, Governor, or Strategist.
     */
    modifier onlyVaultOrGovernorOrStrategist() {
        require(
            msg.sender == vaultAddress ||
                msg.sender == governor() ||
                msg.sender == IVault(vaultAddress).strategistAddr(),
            "Caller is not the Vault, Governor, or Strategist"
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
        for (uint256 i = 0; i < _rewardTokenAddresses.length; i++) {
            require(
                _rewardTokenAddresses[i] != address(0),
                "Can not set an empty address as a reward token"
            );
        }

        emit RewardTokenAddressesUpdated(
            rewardTokenAddresses,
            _rewardTokenAddresses
        );
        rewardTokenAddresses = _rewardTokenAddresses;
    }

    /**
     * @dev Get the reward token addresses.
     * @return address[] the reward token addresses.
     */
    function getRewardTokenAddresses()
        external
        view
        returns (address[] memory)
    {
        return rewardTokenAddresses;
    }

    /**
     * @dev Update the list of supported platform tokens
     *      This method can only be called by the system Governor
     * @param _platformTokens   Address for the corresponding platform token
     */
    function setPlatformTokenAddresses(address[] calldata _platformTokens)
        external
        onlyGovernor
    {
        emit PlatformTokenAddressesUpdated(
            platformTokens,
            _platformTokens
        );
        platformTokens = _platformTokens;
    }


    /**
     * @dev Get the platform token addresses.
     * @return address[] the platform token addresses.
     */
    function getPlatformTokenAddresses()
        external
        view
        returns (address[] memory)
    {
        return platformTokens;
    }

    /**
     * @dev Update the list of supported asset tokens
     *      This method can only be called by the system Governor
     * @param _assetsSupported   Address for the supported asset tokens
     */
    function setAssetSupportedAddresses(address[] calldata _assetsSupported)
        external
        onlyGovernor
    {
        emit AssetSupportedAddressesUpdated(
            assetsSupported,
            _assetsSupported
        );
        assetsSupported = _assetsSupported;
    }


    /**
     * @dev Get the list of the supported asset tokens.
     * @return address[] of the supported asset tokens.
     */
    function getAssetSupportedAddresses()
        external
        view
        returns (address[] memory)
    {
        return assetsSupported;
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
     * @dev Set the reward token addresses.
     * @param _harvesterAddress Address of the harvester
     */
    function setHarvesterAddress(address _harvesterAddress)
        external
        onlyGovernor
    {
        harvesterAddress = _harvesterAddress;
        emit HarvesterAddressUpdated(harvesterAddress, _harvesterAddress);
    }

    /***************************************
                 Abstract
    ****************************************/
    function safeApproveAllTokens() external virtual;

    /**
     * @dev Deposit assets with corresponding amounts into the platform
     * @param _assets               Addresses for the assets
     * @param _amounts              Units of assets to deposit
     */
    function deposit(address[] calldata _assets, address[] calldata _amounts) external virtual;

    /**
     * @dev Deposit balance of all supported assets into the platform
     */
    function depositAll() external virtual;

    /**
     * @dev Withdraw assets with corresponding amounts from the platform.
     * @param _recipient         Address to which the asset should be sent
     * @param _assets            Addresses of the assets
     * @param _amounts           Units of assets to withdraw
     */
    function withdraw(
        address _recipient,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external virtual;

    /**
     * @dev Withdraws assets in a balanced manner (in case there are multiple
     *      platform tokens) totaling up to _ethAmount
     * @param _recipient         Address to which the asset should be sent
     * @param _ethAmount         Total ETH value of assets withdrawn
     */
    function withdrawUnits(
        address _recipient,
        uint245 _ethAmount
    ) external virtual;


    /**
     * @dev Withdraw all assets from strategy sending assets to Vault.
     */
    function withdrawAll() external virtual;

    /**
     * @dev Get the total asset value held in the platform denominated in ETH amounts.
     *      Strategy contracts are responsible for pricing the platform token amounts
     *      in ETH currency.
     *      
     * @return balance    Total ETH value of the asset in the platform
     */
    function checkTotalBalance()
        external
        view
        virtual
        returns (uint256 balance);

    /**
     * @dev Get the total asset value held by the platform denominated in assets own
     *      decimals.
     * 
     *      IMPORTANT: Platform can support depositing multiple assets where withdrawing
     *      one asset affects the balance of another (e.g. Curve's pools). For that reason
     *      this function should not be used to loop through all the supported assets
     *      to get to total strategy liquidity. Use `checkTotalBalance()` for that. 
     * 
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
    function supportsAsset(address _asset) external view virtual returns (bool) {
        for (uint256 i = 0; i < assetsSupported.length; i++) {
            if (assetsSupported[i] == _asset) {
                return true;
            }
        }
        return false;
    }
}
