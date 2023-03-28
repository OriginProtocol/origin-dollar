// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Initializable } from "../utils/Initializable.sol";
import { Governable } from "../governance/Governable.sol";
import { IVault } from "../interfaces/IVault.sol";


/*
V2 Strategy interface

Goals we want to achieve with the renewed strategy interface: 
- platform tokens and assets are not necessarily mapped 1:1. Works well for compound 
  and Aave, not so much for Curve
- can withdraw/deposit multiple tokens instead of single coin. API should allow for 
  strategy to do gas optimizations when withdrawing / depositing liquidity using multiple
  tokens at once, instead of multiple calls to strategy contract with a single token
- cheaper and more effective way to check balance. 

TBD: 
- `checkBalance(_asset)`: does the Vault also need a per asset breakdown of the LSD balances? 
  - and if yes should checkBalance(_asset) return the amount of asset that can be extracted 
    from the strategy or its balanced amount? E.g. if CurveStrategy (stEth/WETH) has 2 ETH's worth of 
    liquidity should checkBalance report: 
    - checkBalance(WETH) -> 1ETH
    - or checkBalance(WETH) -> 2ETH
  - We will also enter pools that have vanilla ETH as one of the pairs(e.g. (stEth/ETH)). In that case 
    checkBalance(stEth) should for sure report 2ETH. 
  - I am in favour of reporting 2ETH with disclaimer that checkBalance should not be used to 
    loop thorough the assets and sum up their balances to figure out strategy balance

- should transferToken always transfer to the governor? TimelockController might not
  have the functionality to do anything with ERC20 tokens

*/
abstract contract InitializableAbstractStrategy is Initializable, Governable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    //event Deposit(address indexed _asset, address _pToken, uint256 _amount);
    //event Withdrawal(address indexed _asset, address _pToken, uint256 _amount);
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
    event AssetsSupportedUpdated(
        address[] _oldAddresses,
        address[] _newAddresses
    );
    event HarvesterAddressesUpdated(
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
        address _platformAddress,
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
    function setAssetsSupportedAddresses(address[] calldata _assetsSupported)
        external
        onlyGovernor
    {
        emit AssetsSupportedUpdated(
            assetsSupported,
            _assetsSupported
        );
        assetsSupported = _assetsSupported;
    }


    /**
     * @dev Get the list of the supported asset tokens.
     * @return address[] of the supported asset tokens.
     */
    function getAssetsSupportedAddresses()
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
        emit HarvesterAddressesUpdated(harvesterAddress, _harvesterAddress);
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
    };
}
