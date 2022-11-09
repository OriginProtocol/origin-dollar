// SPDX-License-Identifier: GNU AGPLv3
pragma solidity ^0.8.0;

import "./Types.sol";
import "../IComptroller.sol";
import "./compound/ICompoundOracle.sol";

// prettier-ignore
interface IMorpho {
    function comptroller() external view returns (IComptroller);
    function supply(address _poolTokenAddress, address _onBehalf, uint256 _amount) external;
    function supply(address _poolTokenAddress, address _onBehalf, uint256 _amount, uint256 _maxGasForMatching) external;
    function withdraw(address _poolTokenAddress, uint256 _amount) external;
    function claimRewards(
        address[] calldata _cTokenAddresses,
        bool _tradeForMorphoToken
    ) external returns (uint256 claimedAmount);
}
