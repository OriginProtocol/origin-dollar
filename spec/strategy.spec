using MockCToken as cToken

methods {
    assetToPToken(address) returns (address) envfree
    checkBalance(address) returns uint256 envfree
    deposit(address, uint256) envfree
    governor() returns address envfree
    isListedAsPlatformToken(address, uint256) returns (bool) envfree
    lengthOfPlatformTokensList() returns (uint256) envfree
    removePToken(uint256)
    withdraw(address, address, uint256) envfree

    // dispatch summaries
    approve(address,uint256) => DISPATCHER(true)
    balanceOf(address) => DISPATCHER(true)
    exchangeRateStored() => DISPATCHER(true)
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
}

// TODO: Check that Ptokens are not keys in assetsToPToken?

/**
assetToPToken(asset) != 0 => exists index. isListedAsPlatformToken(asset, index)
 */
/*rule integrityOfAssetsList_everySupportedAssetAppearsInList(address asset1, address asset2, method f) {
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
        (isListedAsPlatformToken(asset1, index2) && assetToPToken(asset2) == 0) ||≤
        isListedAsPlatformToken(asset1, lengthOfList)
    );

}*/

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
}*/


/*
    The deposit operation of an asset transfers amount of underlying tokens to
    the platform, and gets in return an amount of platform tokens that have a value
    equal to the deposited amount.
*/
rule integrityOfDeposit(address asset) {
    uint256 amount;
    require assetToPToken(asset) == cToken;


    uint256 platformBalanceBefore = checkBalance(asset);

    deposit@withrevert(asset, amount); // TODO with no revert ?
    bool depositReverted = lastReverted;

    uint256 platformBalanceAfter = checkBalance(asset);
    assert !depositReverted => (platformBalanceAfter - platformBalanceBefore == amount), "deposit resulted in unexpected balances change";
}


rule checkBalanceRule(address asset, method f) {
    env e;
    calldataarg arg;
    require assetToPToken(asset) == cToken;

    uint256 platformBalanceBefore = checkBalance(asset);
    f(e, arg);
    uint256 platformBalanceAfter = checkBalance(asset);
    assert (platformBalanceAfter == platformBalanceBefore), "resulted in unexpected balances change";
}


rule checkRemoveTokenRule(address asset, uint256 _assetIndex){
    require assetToPToken(asset) == cToken;
    env e;
    // require assetsMapped[_assetIndex] == asset;
    require isListedAsPlatformToken(asset, _assetIndex);
    bool isPrivileged = e.msg.sender == governor();
    require isPrivileged;

    uint256 platformBalanceBefore = checkBalance(asset);

    removePToken@withrevert(e, _assetIndex);
    bool removePTokenReverted = lastReverted;

    uint256 platformBalanceAfter = checkBalance(asset);

    assert !removePTokenReverted => platformBalanceAfter == platformBalanceBefore, "removePToken resulted in unexpected balances change";
    assert false;
}


rule reversibility_of_deposit(address asset) {
    // A deposit operation can be inverted, and the funds can be restored.

    uint256 amount;
    require assetToPToken(asset) != 0; // pToken is set

    uint256 platformBalanceBefore = checkBalance(asset);
    // uint256 underlyingBalanceBefore = Certora_underlyingBalance(asset);

    deposit@withrevert(asset, amount);
    bool depositReverted = lastReverted;
    // what is currentContract when there are two (or more) contract?
    withdraw@withrevert(currentContract, asset, amount);
    bool withdrawReverted = lastReverted;

    uint256 platformBalanceAfter = checkBalance(asset);
    // uint256 underlyingBalanceAfter = Certora_underlyingBalance(asset);

    // assert !depositReverted => ( !withdrawReverted &&
    //                             (platformBalanceAfter - platformBalanceBefore == amount &&
    //                              underlyingBalanceBefore - underlyingBalanceAfter == amount) ), "deposit resulted in unexpected balances change";

    assert !depositReverted => ( !withdrawReverted =>
                                 platformBalanceAfter == platformBalanceBefore ),
                                 "withdraw deposited amount resulted in unexpected balances change";

}