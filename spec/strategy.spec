methods {
    assetToPToken(address) returns (address) envfree
    isListedAsPlatformToken(address, uint256) returns (bool) envfree
    lengthOfPlatformTokensList() returns (uint256) envfree
    removePToken(uint256)
    underlyingBalance(address) returns (uint256) envfree
    underlyingBalanceOf(address,address) returns (uint256) envfree
    vaultAddress() returns (address) envfree

    // dispatch summaries
    approve(address,uint256) => DISPATCHER(true)
    balanceOf(address) => DISPATCHER(true)
    allowance(address,address) => DISPATCHER(true)
    exchangeRateStored() => ALWAYS(1000000000000000000) // 1e18
    mint(uint256) => DISPATCHER(true)
    redeem(uint256) => DISPATCHER(true)
    redeemUnderlying(uint256) => DISPATCHER(true)
    transfer(address, uint256) => DISPATCHER(true)

    // NONDET
    deposit(address, uint256, uint16) => NONDET
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
hook Sstore (slot 54)/*assetsMapped*/ uint lenNew STORAGE {
    havoc assetListLen assuming assetListLen@new() == lenNew;
}

// establish the ghost list (so that it can be used in quantified contexts)
hook Sload address n (slot 54)/*assetsMapped*/[INDEX uint index] STORAGE {
    require assetList(index) == n;
}

hook Sstore (slot 54)/*assetsMapped*/[INDEX uint index] address n (address o) STORAGE {
    require IS_ADDRESS(n);
    require IS_ADDRESS(o);
    havoc assetList assuming assetList@new(index) == n &&
        (forall uint i. i != index => assetList@new(i) == assetList@old(i));
}

// define the isListed predicate
definition isListed(address a, uint i) returns bool = 0 <= i && i < assetListLen() && assetList(i) == a
    ;

// Lemma: the ghosted list length is equal to the array's length (bounds size will apply here, the axiom will not allow it to get to MAX_UINT256)
invariant length_lemma() lengthOfPlatformTokensList() == assetListLen()

invariant supportedAssetIsInList(address asset) asset != 0 => assetToPToken(asset) != 0 => (exists uint i. isListed(asset, i)) {
    preserved setPTokenAddress(address a, address b) with (env e) {
        requireInvariant length_lemma();
    }

    preserved removePToken(uint index) with (env e) {
        requireInvariant length_lemma();
    }

    preserved {
        requireInvariant length_lemma();
    }
}


invariant assetInListIsSupported(address asset) asset != 0 => (exists uint i. isListed(asset, i)) => assetToPToken(asset) != 0 {
    preserved setPTokenAddress(address _, address _) with (env e) {
         requireInvariant length_lemma();
    }

    preserved removePToken(uint index) with (env e) {
        address matchingAsset = assetList(index);
        if (assetToPToken(matchingAsset) != 0) {
            requireInvariant uniqueAssetsInList(matchingAsset); // cannot have another instance of the removed asset
        }
        requireInvariant length_lemma();
    }

    preserved {
        requireInvariant length_lemma();
    }
}

// TODO: Change to: isListed(asset, j) => j == i
// TODO: Change to forall uint i. forall uint j. (isListed(asset, i) && isListed(asset, j)) => j == i
invariant uniqueAssetsInList(address asset) asset != 0 => (forall uint i. isListed(asset, i) => (forall uint j. j != i => !isListed(asset, j))) {
    preserved setPTokenAddress(address a, address b) with (env e) {
        requireInvariant assetInListIsSupported(a); // if the asset exists, then it is supported (thus cannot add it again)
        requireInvariant length_lemma();
    }

    preserved removePToken(uint index) with (env e) {
        requireInvariant length_lemma();
    }

    preserved initialize(address a,address b,address c,address[] d,address[] e) with (env f) {
        require false; // TODO CERTORA: Quantify over the list of addresses. This boils down to setPTokenAddress correctness
        // TODO: requireInvariant length_lemma();
    }
}


// TODO: Check that Ptokens are not keys in assetsToPToken?

/**
assetToPToken(asset) != 0 => exists index. isListedAsPlatformToken(asset, index)
 */

definition allowedIncreaseInTokensList() returns uint = 10
    ;


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

rule withdrawByVault(address asset, method f) {
    address theVault = vaultAddress();
    env e1;
    uint strategyBalanceBefore = checkBalance(e1,asset) + underlyingBalance(asset);
    uint vaultBalanceBefore = underlyingBalanceOf(asset, theVault);

    env e;
    calldataarg arg;
    f(e, arg);

    env e2;
    uint strategyBalanceAfter = checkBalance(e2,asset) + underlyingBalance(asset);
    uint vaultBalanceAfter = underlyingBalanceOf(asset, theVault);

    mathint delta = strategyBalanceBefore - strategyBalanceAfter;
    assert delta > 0 => (delta == vaultBalanceAfter - vaultBalanceBefore || e.msg.sender == theVault);
}