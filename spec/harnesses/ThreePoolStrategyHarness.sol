import "../../contracts/contracts/strategies/ThreePoolStrategy.sol";

contract ThreePoolStrategyHarness is ThreePoolStrategy {
    function isInitialized() external returns (bool) {
        return assetsMapped.length == 3 
            && assetsMapped[0] != assetsMapped[1] 
            && assetsMapped[1] != assetsMapped[2] 
            && assetsMapped[0] != assetsMapped[2];
    }

    function isMappedToCoinIndex(address asset) external returns (bool) {
        return assetsMapped[0] == asset || assetsMapped[1] == asset || assetsMapped[2] == asset;
    }
}