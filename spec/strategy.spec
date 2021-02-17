methods {
    assetToPToken(address) returns (address) envfree
    isListedAsPlatformToken(address, uint256) returns (bool) envfree
    lengthOfPlatformTokensList() returns (uint256) envfree

    // dispatch summaries
    approve(address,uint256) => DISPATCHER(true)
}

definition MAX_UINT256() returns uint256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    ;

definition allowedIncreaseInTokensList() returns uint256 = 10 /* max unroll factor */
    ;

/**
assetToPToken(asset) != 0 => exists index. isListedAsPlatformToken(asset, index)
 */
rule integrityOfAssetsList_everySupportedAssetAppearsInList(address asset1, address asset2, method f) {
    require asset1 != asset2;
    uint index1;
    uint index2;
    require assetToPToken(asset1) != 0 => isListedAsPlatformToken(asset1, index1);
    require assetToPToken(asset2) != 0 => isListedAsPlatformToken(asset2, index2);
    //require index1 != index2;

    uint lengthOfList = lengthOfPlatformTokensList();
    require lengthOfList < MAX_UINT256() - allowedIncreaseInTokensList();

    env e;
    calldataarg arg;
    f(e, arg);

    // if asset1 and asset2 did not change, this is not interesting.

    assert assetToPToken(asset1) != 0 => (
        isListedAsPlatformToken(asset1, index1) ||
        (isListedAsPlatformToken(asset1, index2) && assetToPToken(asset2) == 0) ||
        isListedAsPlatformToken(asset1, lengthOfList)
    );

}


rule lengthChangeIsBounded(method f) {
    uint allowedDecrease = 1;

    uint _len = lengthOfPlatformTokensList();
    require _len < MAX_UINT256() - allowedIncreaseInTokensList();

    env e;
    calldataarg arg;
    f(e,arg);
    uint len_ = lengthOfPlatformTokensList();

    assert len_ - _len <= allowedIncreaseInTokensList() && _len - len_ <= allowedDecrease;
}