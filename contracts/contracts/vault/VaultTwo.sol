// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";

import { IStrategy } from "../interfaces/IStrategy.sol";
import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";

contract VaultTwo is Initializable, Governable {
    using SafeERC20 for IERC20;

    bool public capitalPaused;
    bool public rebasePaused;

    // event AssetSupported(address _asset);
    // event AssetDefaultStrategyUpdated(address _asset, address _strategy);
    // event AssetAllocated(address _asset, address _strategy, uint256 _amount);
    // event StrategyApproved(address _addr);
    // event StrategyRemoved(address _addr);
    // event Mint(address _addr, uint256 _value);
    // event Redeem(address _addr, uint256 _value);
    // event CapitalPaused();
    // event CapitalUnpaused();
    // event RebasePaused();
    // event RebaseUnpaused();
    // event VaultBufferUpdated(uint256 _vaultBuffer);
    // event OusdMetaStrategyUpdated(address _ousdMetaStrategy);
    // event RedeemFeeUpdated(uint256 _redeemFeeBps);
    // event PriceProviderUpdated(address _priceProvider);
    // event AllocateThresholdUpdated(uint256 _threshold);
    // event RebaseThresholdUpdated(uint256 _threshold);
    // event StrategistUpdated(address _address);
    // event MaxSupplyDiffChanged(uint256 maxSupplyDiff);
    // event YieldDistribution(address _to, uint256 _yield, uint256 _fee);
    // event TrusteeFeeBpsChanged(uint256 _basis);
    // event TrusteeAddressChanged(address _address);
    // event NetOusdMintForStrategyThresholdChanged(uint256 _threshold);

    /**
     * @dev Verifies that the rebasing is not paused.
     */
    modifier whenNotRebasePaused() {
        require(!rebasePaused, "Rebasing paused");
        _;
    }

    /**
     * @dev Verifies that the deposits are not paused.
     */
    modifier whenNotCapitalPaused() {
        require(!capitalPaused, "Capital paused");
        _;
    }

    modifier onlyOusdMetaStrategy() {
        require(false, "Not support");
        _;
    }

    constructor() {}

    function mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumOusdAmount
    ) external whenNotCapitalPaused nonReentrant {
        // Todo
    }

    function mintForStrategy(uint256 _amount)
        external
        whenNotCapitalPaused
        onlyOusdMetaStrategy
    {
        require(false, "Not supported");
    }

    function redeem(uint256 _amount, uint256 _minimumUnitAmount)
        external
        whenNotCapitalPaused
        nonReentrant
    {
        // Todo
    }

    function burnForStrategy(uint256 _amount)
        external
        whenNotCapitalPaused
        onlyOusdMetaStrategy
    {
        require(false, "Not supported");
    }

    function redeemAll(uint256 _minimumUnitAmount)
        external
        whenNotCapitalPaused
        nonReentrant
    {
        // Todo
    }

    function rebase() external virtual nonReentrant {
        // Todo
    }

    function totalValue() external view virtual returns (uint256 value) {
        // Todo
    }

    /**
     * @notice Get the balance of an asset held in Vault and all strategies.
     * @param _asset Address of asset
     * @return uint256 Balance of asset in decimals of asset
     */
    function checkBalance(address _asset) external view returns (uint256) {
        // Todo
    }

    /***************************************
                    Utils
    ****************************************/

    /**
     * @dev Return the number of assets supported by the Vault.
     */
    function getAssetCount() public view returns (uint256) {
        // return allAssets.length;
    }

    /**
     * @dev Return all asset addresses in order
     */
    function getAllAssets() external view returns (address[] memory) {
        // return allAssets;
    }

    /**
     * @dev Return the number of strategies active on the Vault.
     */
    function getStrategyCount() external view returns (uint256) {
        // return allStrategies.length;
    }

    /**
     * @dev Return the array of all strategies
     */
    function getAllStrategies() external view returns (address[] memory) {
        // return allStrategies;
    }

    function isSupportedAsset(address _asset) external view returns (bool) {
        // return assets[_asset].isSupported;
    }
}
