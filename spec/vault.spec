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

// ghosts for assets
ghost assetList(uint) returns address;
ghost assetListLen() returns uint {
    init_state axiom 0 <= assetListLen() && assetListLen() < 115792089237316195423570985008687907853269984665640564039457584007913129639935 /*MAX_UINT256()*/; // <=?
    axiom assetListLen() < 115792089237316195423570985008687907853269984665640564039457584007913129639935 /*MAX_UINT256()*/; // a reasonable assumption
}

// ghosts for strategies
ghost strategyList(uint) returns address;
ghost strategyListLen() returns uint {
    init_state axiom 0 <= strategyListLen() && strategyListLen() < 115792089237316195423570985008687907853269984665640564039457584007913129639935 /*MAX_UINT256()*/; // <=?
    axiom strategyListLen() < 115792089237316195423570985008687907853269984665640564039457584007913129639935 /*MAX_UINT256()*/; // a reasonable assumption
}

// hooks
// establish asset list length
hook Sstore (slot 52)/*allAssets*/ uint lenNew STORAGE {
    havoc assetListLen assuming assetListLen@new() == lenNew;
}

// establish strategy list length
hook Sstore (slot 54)/*allStrategies*/ uint lenNew STORAGE {
    havoc strategyListLen assuming strategyListLen@new() == lenNew;
}

// establish the asset ghost list (so that it can be used in quantified contexts)
hook Sload address n (slot 52)/*allAssets*/[INDEX uint index] STORAGE {
    require assetList(index) == n;
}

hook Sstore (slot 52)/*allAssets*/[INDEX uint index] address n (address o) STORAGE {
    require IS_ADDRESS(n);
    require IS_ADDRESS(o);
    havoc assetList assuming assetList@new(index) == n &&
        (forall uint i. i != index => assetList@new(i) == assetList@old(i));
}

// establish the strategy ghost list (so that it can be used in quantified contexts)
hook Sload address n (slot 54)/*allStrategies*/[INDEX uint index] STORAGE {
    require strategyList(index) == n;
}

hook Sstore (slot 54)/*allStrategies*/[INDEX uint index] address n (address o) STORAGE {
    require IS_ADDRESS(n);
    require IS_ADDRESS(o);
    havoc strategyList assuming strategyList@new(index) == n &&
        (forall uint i. i != index => strategyList@new(i) == strategyList@old(i));
}

// define the isListed predicate
definition isAssetListed(address a, uint i) returns bool = 0 <= i && i < assetListLen() && assetList(i) == a
    ;
definition isStrategyListed(address a, uint i) returns bool = 0 <= i && i < strategyListLen() && strategyList(i) == a
    ;

// Lemma: the ghosted list length is equal to the array's length (bounds size will apply here, the axiom will not allow it to get to MAX_UINT256)
invariant asset_length_lemma() vault.Certora_getAssetCount() == assetListLen()
invariant strategy_length_lemma() vault.Certora_getStrategyCount() == strategyListLen()

invariant supportedAssetIsInList(address asset) asset != 0 => vault.Certora_isSupportedAsset(asset) => (exists uint i. isAssetListed(asset, i)) {
    preserved {
        requireInvariant asset_length_lemma();
    }
}

invariant supportedStrategyIsInList(address strategy) strategy != 0 => vault.Certora_isSupportedStrategy(strategy) => (exists uint i. isStrategyListed(strategy, i)) {
    preserved {
        requireInvariant strategy_length_lemma();
    }
}

invariant assetInListIsSupported(address asset) asset != 0 => (exists uint i. isAssetListed(asset, i)) => vault.Certora_isSupportedAsset(asset) {
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

invariant strategyInListIsSupported(address strategy) strategy != 0 => (exists uint i. isStrategyListed(strategy, i)) => vault.Certora_isSupportedStrategy(strategy) {
    preserved removeStrategy(address a) with (env e) {
        if (vault.Certora_isSupportedStrategy(a)) {
            requireInvariant uniqueStrategiesInList(a); // cannot have another instance of the removed strategy
        }
        requireInvariant strategy_length_lemma();
    }

    preserved {
        requireInvariant strategy_length_lemma();
    }
}

// TODO: Change to: isAssetListed(asset, j) => j == i
// TODO: Change to forall uint i. forall uint j. (isAssetListed(asset, i) && isAssetListed(asset, j)) => j == i
invariant uniqueAssetsInList(address asset) asset != 0 => (forall uint i. isAssetListed(asset, i) => (forall uint j. j != i => !isAssetListed(asset, j))) {
    preserved supportAsset(address a) with (env e) {
        requireInvariant assetInListIsSupported(a); // if the asset exists, then it is supported (thus cannot add it again)
        requireInvariant asset_length_lemma();
    }
}

invariant uniqueStrategiesInList(address strategy) strategy != 0 => (forall uint i. isStrategyListed(strategy, i) => (forall uint j. j != i => !isStrategyListed(strategy, j))) {
    preserved approveStrategy(address a) with (env e) {
        requireInvariant strategyInListIsSupported(a); // if the strategy exists, then it is supported (thus cannot add it again)
        requireInvariant strategy_length_lemma();
    }

    preserved removeStrategy(address a) with (env e) {
        requireInvariant strategy_length_lemma();
    }
}

definition allowedIncrease() returns uint = 10
    ;

rule assetLengthChangeIsBounded(method f) {
    uint allowedDecrease = 1;

    uint _len = vault.Certora_getAssetCount();
    require _len < MAX_UINT256() - allowedIncrease();

    env e;
    calldataarg arg;
    f(e,arg);
    uint len_ = vault.Certora_getAssetCount();

    assert len_ - _len <= allowedIncrease() && _len - len_ <= allowedDecrease;
}

rule strategyLengthChangeIsBounded(method f) {
    uint allowedDecrease = 1;

    uint _len = vault.Certora_getStrategyCount();
    require _len < MAX_UINT256() - allowedIncrease();

    env e;
    calldataarg arg;
    f(e,arg);
    uint len_ = vault.Certora_getStrategyCount();

    assert len_ - _len <= allowedIncrease() && _len - len_ <= allowedDecrease;
}