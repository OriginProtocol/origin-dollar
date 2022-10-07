// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title OUSD Compound Strategy
 * @notice Investment strategy for investing stablecoins via Compound
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BaseCompoundStrategy } from "./BaseCompoundStrategy.sol";
import { IERC20 } from "../utils/InitializableAbstractStrategy.sol";
import { IMorpho, ICompoundOracle } from "../interfaces/morpho/IMorpho.sol";
import { ILens } from "../interfaces/morpho/ILens.sol";
import { StableMath } from "../utils/StableMath.sol";
import "../utils/Helpers.sol";


contract MorphoCompoundStrategy is BaseCompoundStrategy {
    address public constant MORPHO = 0x8888882f8f843896699869179fB6E4f7e3B58888;
    address public constant LENS = 0x930f1b46e1D081Ec1524efD95752bE3eCe51EF67;
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    event SkippedWithdrawal(address asset, uint256 amount);

    ICompoundOracle public ORACLE;


    /**
     * @dev Internal initialize function, to set up initial internal state
     * @param _vaultAddress Address of the Vault
     * @param _rewardTokenAddresses Address of reward token for platform
     * @param _assets Addresses of initial supported assets
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses,
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external onlyGovernor initializer {
        super._initialize(
            MORPHO,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        ORACLE = ICompoundOracle(IMorpho(MORPHO).comptroller().oracle());
    }

    /**
     * @dev Approve the spending of all assets by their corresponding cToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() external override {
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; i++) {
            address asset = assetsMapped[i];

            // Safe approval
            IERC20(asset).safeApprove(MORPHO, 0);
            IERC20(asset).safeApprove(MORPHO, type(uint256).max);
        }
    }

    /**
     * TODO: comment not right
     * @dev Internal method to respond to the addition of new asset / cTokens
     *      We need to approve the cToken and give it permission to spend the asset
     * @param _asset Address of the asset to approve
     * @param _pToken The pToken for the approval
     */
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {
        // Safe approval
        // IERC20(_pToken).safeApprove(MORPHO, 0);
        // IERC20(_pToken).safeApprove(MORPHO, type(uint256).max);
    }

    /**
     * @dev Collect accumulated rewards and send to Harvester.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        
    }

    /**
     * @dev Deposit asset into Morpho
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    /**
     * @dev Deposit asset into Morpho
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_amount > 0, "Must deposit something");

        IMorpho(MORPHO).supply(
            address(_getCTokenFor(_asset)),
            address(this), // the address of the user you want to supply on behalf of
            _amount
        );
        emit Deposit(_asset, address(0), _amount);
    }

    /**
     * @dev Deposit the entire balance of any supported asset into Compound
     */
    function depositAll() external override onlyVault nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            uint256 balance = IERC20(assetsMapped[i]).balanceOf(address(this));
            if (balance > 0) {
                _deposit(assetsMapped[i], balance);
            }
        }
    }

    /**
     * @dev Withdraw asset from Compound
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        _withdraw(_recipient, _asset, _amount);
    }

    function _withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) internal onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");

        address pToken = assetToPToken[_asset];
        uint256 oraclePrice = ORACLE.getUnderlyingPrice(pToken);

        IMorpho(MORPHO).withdraw(
            pToken,
            _amount.divPrecisely(oraclePrice)
        );

        emit Withdrawal(_asset, address(0), _amount);
        IERC20(_asset).safeTransfer(_recipient, _amount);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            uint256 balance = _checkBalance(assetsMapped[i]);
            _withdraw(vaultAddress, assetsMapped[i], balance);
        }
    }

    /**
     * @dev TODO
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {

        return _checkBalance(_asset);
    }

    /**
     * @dev TODO
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function _checkBalance(address _asset)
        internal
        view
        returns (uint256 balance)
    {
        address pToken = assetToPToken[_asset];

        // both represented with 18 decimals no matter the underlying token
        (uint256 suppliedOnPool, uint256 suppliedP2P, ) = ILens(LENS)
            .getCurrentSupplyBalanceInOf(
                pToken,
                address(this) // the address of the user you want to know the supply of
            );

        uint256 assetDecimals = Helpers.getDecimals(_asset);
        uint256 oraclePrice = ORACLE.getUnderlyingPrice(pToken);
        uint256 suppliedOnPoolUSD = suppliedOnPool.mulTruncate(oraclePrice).scaleBy(assetDecimals, 18);
        uint256 suppliedP2PUSD = suppliedP2P.mulTruncate(oraclePrice).scaleBy(assetDecimals, 18);

        return suppliedOnPoolUSD + suppliedP2PUSD;
    }
}
