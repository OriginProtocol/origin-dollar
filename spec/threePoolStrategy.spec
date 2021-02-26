methods {
    isInitialized() returns (bool) envfree
    isMappedToCoinIndex(address) returns (bool) envfree
    assetToPToken(address) returns (address) envfree
}

rule non3PoolAssetDisallowed(method f) {
    require isInitialized();
    address asset;
    bool isMappedAsset = isMappedToCoinIndex(asset);
    // from previous invariants proven: asset is mapped to PToken iff it's in array
    require assetToPToken(asset) != 0 <=> isMappedAsset;

    env e;
    bool succeeded;
    if (f.selector == deposit(address,uint256).selector) {
        uint amt;    
        deposit@withrevert(e,asset,amt);
        succeeded = !lastReverted;
    } else if (f.selector == withdraw(address,address,uint256).selector) {
        address recipient;
        uint amt;
        withdraw@withrevert(e,recipient,asset,amt);
        succeeded = !lastReverted;
    } else if (f.selector == checkBalance(address).selector) {
        checkBalance@withrevert(e,asset);
        succeeded = !lastReverted;
    } else {
        succeeded = false;
    }

    assert succeeded => isMappedAsset, "If succeeded to run with an asset, it must be mapped to a pool coin index";


}