// SPDX-License-Identifier: GNU AGPLv3
pragma solidity ^0.8.0;

import "./compound/ICompoundOracle.sol";
import "./IMorpho.sol";

interface ILens {
    /// STORAGE ///

    function MAX_BASIS_POINTS() external view returns (uint256);

    function WAD() external view returns (uint256);

    function morpho() external view returns (IMorpho);

    function comptroller() external view returns (IComptroller);

    /// GENERAL ///

    function getTotalSupply()
        external
        view
        returns (
            uint256 p2pSupplyAmount,
            uint256 poolSupplyAmount,
            uint256 totalSupplyAmount
        );

    function getTotalBorrow()
        external
        view
        returns (
            uint256 p2pBorrowAmount,
            uint256 poolBorrowAmount,
            uint256 totalBorrowAmount
        );

    /// MARKETS ///

    function isMarketCreated(address _poolToken) external view returns (bool);

    function isMarketCreatedAndNotPaused(address _poolToken)
        external
        view
        returns (bool);

    function isMarketCreatedAndNotPausedNorPartiallyPaused(address _poolToken)
        external
        view
        returns (bool);

    function getAllMarkets()
        external
        view
        returns (address[] memory marketsCreated_);

    function getMainMarketData(address _poolToken)
        external
        view
        returns (
            uint256 avgSupplyRatePerBlock,
            uint256 avgBorrowRatePerBlock,
            uint256 p2pSupplyAmount,
            uint256 p2pBorrowAmount,
            uint256 poolSupplyAmount,
            uint256 poolBorrowAmount
        );

    function getAdvancedMarketData(address _poolToken)
        external
        view
        returns (
            uint256 p2pSupplyIndex,
            uint256 p2pBorrowIndex,
            uint256 poolSupplyIndex,
            uint256 poolBorrowIndex,
            uint32 lastUpdateBlockNumber,
            uint256 p2pSupplyDelta,
            uint256 p2pBorrowDelta
        );

    function getMarketConfiguration(address _poolToken)
        external
        view
        returns (
            address underlying,
            bool isCreated,
            bool p2pDisabled,
            bool isPaused,
            bool isPartiallyPaused,
            uint16 reserveFactor,
            uint16 p2pIndexCursor,
            uint256 collateralFactor
        );

    function getTotalMarketSupply(address _poolToken)
        external
        view
        returns (uint256 p2pSupplyAmount, uint256 poolSupplyAmount);

    function getTotalMarketBorrow(address _poolToken)
        external
        view
        returns (uint256 p2pBorrowAmount, uint256 poolBorrowAmount);

    /// INDEXES ///

    function getCurrentP2PSupplyIndex(address _poolToken)
        external
        view
        returns (uint256);

    function getCurrentP2PBorrowIndex(address _poolToken)
        external
        view
        returns (uint256);

    function getCurrentPoolIndexes(address _poolToken)
        external
        view
        returns (
            uint256 currentPoolSupplyIndex,
            uint256 currentPoolBorrowIndex
        );

    function getIndexes(address _poolToken, bool _computeUpdatedIndexes)
        external
        view
        returns (
            uint256 p2pSupplyIndex,
            uint256 p2pBorrowIndex,
            uint256 poolSupplyIndex,
            uint256 poolBorrowIndex
        );

    /// USERS ///

    function getEnteredMarkets(address _user)
        external
        view
        returns (address[] memory enteredMarkets);

    function getUserHealthFactor(
        address _user,
        address[] calldata _updatedMarkets
    ) external view returns (uint256);

    function getUserBalanceStates(
        address _user,
        address[] calldata _updatedMarkets
    )
        external
        view
        returns (
            uint256 collateralValue,
            uint256 debtValue,
            uint256 maxDebtValue
        );

    function getCurrentSupplyBalanceInOf(address _poolToken, address _user)
        external
        view
        returns (
            uint256 balanceOnPool,
            uint256 balanceInP2P,
            uint256 totalBalance
        );

    function getCurrentBorrowBalanceInOf(address _poolToken, address _user)
        external
        view
        returns (
            uint256 balanceOnPool,
            uint256 balanceInP2P,
            uint256 totalBalance
        );

    function getUserMaxCapacitiesForAsset(address _user, address _poolToken)
        external
        view
        returns (uint256 withdrawable, uint256 borrowable);

    function getUserHypotheticalBalanceStates(
        address _user,
        address _poolToken,
        uint256 _withdrawnAmount,
        uint256 _borrowedAmount
    ) external view returns (uint256 debtValue, uint256 maxDebtValue);

    function getUserLiquidityDataForAsset(
        address _user,
        address _poolToken,
        bool _computeUpdatedIndexes,
        ICompoundOracle _oracle
    ) external view returns (Types.AssetLiquidityData memory assetData);

    function isLiquidatable(address _user, address[] memory _updatedMarkets)
        external
        view
        returns (bool);

    function computeLiquidationRepayAmount(
        address _user,
        address _poolTokenBorrowed,
        address _poolTokenCollateral,
        address[] calldata _updatedMarkets
    ) external view returns (uint256 toRepay);

    /// RATES ///

    function getAverageSupplyRatePerBlock(address _poolToken)
        external
        view
        returns (
            uint256 avgSupplyRatePerBlock,
            uint256 p2pSupplyAmount,
            uint256 poolSupplyAmount
        );

    function getAverageBorrowRatePerBlock(address _poolToken)
        external
        view
        returns (
            uint256 avgBorrowRatePerBlock,
            uint256 p2pBorrowAmount,
            uint256 poolBorrowAmount
        );

    function getNextUserSupplyRatePerBlock(
        address _poolToken,
        address _user,
        uint256 _amount
    )
        external
        view
        returns (
            uint256 nextSupplyRatePerBlock,
            uint256 balanceOnPool,
            uint256 balanceInP2P,
            uint256 totalBalance
        );

    function getNextUserBorrowRatePerBlock(
        address _poolToken,
        address _user,
        uint256 _amount
    )
        external
        view
        returns (
            uint256 nextBorrowRatePerBlock,
            uint256 balanceOnPool,
            uint256 balanceInP2P,
            uint256 totalBalance
        );

    function getCurrentUserSupplyRatePerBlock(address _poolToken, address _user)
        external
        view
        returns (uint256);

    function getCurrentUserBorrowRatePerBlock(address _poolToken, address _user)
        external
        view
        returns (uint256);

    function getRatesPerBlock(address _poolToken)
        external
        view
        returns (
            uint256 p2pSupplyRate,
            uint256 p2pBorrowRate,
            uint256 poolSupplyRate,
            uint256 poolBorrowRate
        );

    /// REWARDS ///

    function getUserUnclaimedRewards(
        address[] calldata _poolTokens,
        address _user
    ) external view returns (uint256 unclaimedRewards);

    function getAccruedSupplierComp(
        address _supplier,
        address _poolToken,
        uint256 _balance
    ) external view returns (uint256);

    function getAccruedBorrowerComp(
        address _borrower,
        address _poolToken,
        uint256 _balance
    ) external view returns (uint256);

    function getCurrentCompSupplyIndex(address _poolToken)
        external
        view
        returns (uint256);

    function getCurrentCompBorrowIndex(address _poolToken)
        external
        view
        returns (uint256);
}
