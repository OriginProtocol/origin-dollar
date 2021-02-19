using VaultHarness as vault

methods {
    vault.Certora_isSupportedAsset(address) returns (bool) envfree
    vault.Certora_getAssetCount() returns (uint256) envfree

    vault.Certora_isSupportedStrategy(address) returns (bool) envfree
    vault.Certora_getStrategyCount() returns (uint256) envfree

    // dispatch summaries
}

// consts and simple macro definitions
definition MAX_UINT256() returns uint256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    ;

definition MAX_UINT160() returns uint256 = 1461501637330902918203684832716283019655932542975
    ;

definition IS_ADDRESS(address x) returns bool = 0 <= x && x <= MAX_UINT160()
    ;

// ghosts
ghost assetList(uint) returns address;
ghost assetListLen() returns uint {
    init_state axiom 0 <= assetListLen() && assetListLen() < 115792089237316195423570985008687907853269984665640564039457584007913129639935 /*MAX_UINT256()*/; // <=?
    axiom assetListLen() < 115792089237316195423570985008687907853269984665640564039457584007913129639935 /*MAX_UINT256()*/; // a reasonable assumption
}

// hooks
// establish asset list length
hook Sstore (slot 52)/*allAssets*/ uint lenNew STORAGE {
    havoc assetListLen assuming assetListLen@new() == lenNew;
}

// establish the ghost list (so that it can be used in quantified contexts)
hook Sload address n (slot 52)/*allAssets*/[INDEX uint index] STORAGE {
    require assetList(index) == n;
}

hook Sstore (slot 52)/*allAssets*/[INDEX uint index] address n (address o) STORAGE {
    require IS_ADDRESS(n);
    require IS_ADDRESS(o);
    havoc assetList assuming assetList@new(index) == n &&
        (forall uint i. i != index => assetList@new(i) == assetList@old(i));
}

// define the isListed predicate
definition isListed(address a, uint i) returns bool = 0 <= i && i < assetListLen() && assetList(i) == a
    ;

// Lemma: the ghosted list length is equal to the array's length (bounds size will apply here, the axiom will not allow it to get to MAX_UINT256)
invariant asset_length_lemma() vault.Certora_getAssetCount() == assetListLen()

invariant supportedAssetIsInList(address asset) asset != 0 => vault.Certora_isSupportedAsset(asset) => (exists uint i. isListed(asset, i)) {
    preserved {
        requireInvariant asset_length_lemma();
    }
}

invariant assetInListIsSupported(address asset) asset != 0 => (exists uint i. isListed(asset, i)) => vault.Certora_isSupportedAsset(asset) {
    /*preserved removePToken(uint index) with (env e) {
        address matchingAsset = assetList(index);
        if (vault.Certora_isSupportedAsset(matchingAsset)) {
            requireInvariant uniqueAssetsInList(matchingAsset); // cannot have another instance of the removed asset
        }
        requireInvariant asset_length_lemma();
    }*/

    preserved {
        requireInvariant asset_length_lemma();
    }
}

// TODO: Change to: isListed(asset, j) => j == i
// TODO: Change to forall uint i. forall uint j. (isListed(asset, i) && isListed(asset, j)) => j == i
invariant uniqueAssetsInList(address asset) asset != 0 => (forall uint i. isListed(asset, i) => (forall uint j. j != i => !isListed(asset, j))) {
    preserved supportAsset(address a) with (env e) {
        requireInvariant assetInListIsSupported(a); // if the asset exists, then it is supported (thus cannot add it again)
        requireInvariant asset_length_lemma();
    }
/*
    preserved removePToken(uint index) with (env e) {
        requireInvariant asset_length_lemma();
    }*/
}

definition allowedIncreaseInTokensList() returns uint = 10
    ;

rule lengthChangeIsBounded(method f) {
    uint allowedDecrease = 1;

    uint _len = vault.Certora_getAssetCount();
    require _len < MAX_UINT256() - allowedIncreaseInTokensList();

    env e;
    calldataarg arg;
    f(e,arg);
    uint len_ = vault.Certora_getAssetCount();

    assert len_ - _len <= allowedIncreaseInTokensList() && _len - len_ <= allowedDecrease;
}