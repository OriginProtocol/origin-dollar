// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Contracts
import { PoolBoosterCurveMainnet } from "./PoolBoosterCurveMainnet.sol";
import { AbstractPoolBoosterFactory, IPoolBoostCentralRegistry } from "./AbstractPoolBoosterFactory.sol";
import { Initializable } from "../utils/Initializable.sol";
import { Strategizable } from "../governance/Strategizable.sol";
import { SimpleBeaconProxy } from "../proxies/SimpleBeaconProxy.sol";

contract PoolBoosterFactoryCurveMainnet is
    Initializable,
    Strategizable,
    AbstractPoolBoosterFactory
{
    uint256 public constant version = 1;
    uint256 public immutable targetChainId;
    address public votemarket;
    address public campaignRemoteManager;

    constructor(
        address _oToken,
        address _centralRegistry,
        uint256 _targetChainId
    ) AbstractPoolBoosterFactory(_oToken, address(0), _centralRegistry) {
        targetChainId = _targetChainId;
        // _setGovernor(address(0)); alreasy set in AbstractPoolBoosterFactory
        _setStrategistAddr(address(0));
    }

    function initialize(
        address _governor,
        address _strategist,
        address _campaignRemoteManager,
        address _votemarket
    ) public initializer {
        _setGovernor(_governor);
        _setStrategistAddr(_strategist);
        campaignRemoteManager = _campaignRemoteManager;
        votemarket = _votemarket;
    }

    function deployAndInitPoolBooster(
        address _gauge,
        address _rewardToken,
        uint256 _entropy
    ) public returns (address) {
        require(_gauge != address(0), "Invalid gauge address");
        require(_rewardToken != address(0), "Invalid reward token address");

        // Compute salt
        uint256 salt = uint256(
            keccak256(
                abi.encodePacked(targetChainId, _gauge, _rewardToken, _entropy)
            )
        );

        // Deploy proxy
        address pb = _deployContract(
            abi.encodePacked(
                type(SimpleBeaconProxy).creationCode,
                abi.encode(address(this))
            ),
            salt
        );

        // Initialize PoolBooster
        PoolBoosterCurveMainnet.InitParams
            memory initParams = PoolBoosterCurveMainnet.InitParams({
                targetChainId: targetChainId,
                rewardToken: _rewardToken,
                gauge: _gauge,
                governor: governor(),
                strategist: strategistAddr,
                fee: 0,
                feeCollector: strategistAddr,
                campaignRemoteManager: campaignRemoteManager,
                votemarket: votemarket
            });
        bytes memory data = abi.encodeWithSelector(
            PoolBoosterCurveMainnet.initialize.selector,
            initParams
        );
        (bool success, ) = pb.call(data);
        require(success, "Failed to initialize PoolBooster");

        // Store PoolBooster entry
        _storePoolBoosterEntry(
            pb,
            _gauge,
            IPoolBoostCentralRegistry.PoolBoosterType.CurveMainnetBooster
        );

        // Return address of the deployed PoolBooster
        return address(pb);
    }

    function computePoolBoosterAddress(
        address _gauge,
        address _rewardToken,
        uint256 _entropy
    ) public view returns (address) {
        // Compute salt
        uint256 salt = uint256(
            keccak256(
                abi.encodePacked(targetChainId, _gauge, _rewardToken, _entropy)
            )
        );

        // Compute address
        return
            _computeAddress(
                abi.encodePacked(
                    type(SimpleBeaconProxy).creationCode,
                    abi.encode(address(this))
                ),
                salt
            );
    }
}
