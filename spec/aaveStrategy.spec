using MockAToken as aToken
using MockAave as lendPool
using DummyERC20A as assetInstance
using DummyERC20A2 as poolInstance

methods {
    assetToPToken(address) returns (address) envfree
    checkBalance(address) returns uint256 envfree
    deposit(address, uint256) envfree
    governor() returns address envfree
    isListedAsPlatformToken(address, uint256) returns (bool) envfree
    lengthOfPlatformTokensList() returns (uint256) envfree
    removePToken(uint256)
    underlyingBalance(address) returns (uint256) envfree
    withdraw(address, address, uint256) envfree
    assetInstance.balanceOf(address) returns (uint256)
    aToken.balanceOf(address) returns (uint256)
    aToken.lendingPool() returns (address) envfree
    lendPool.getLendingPool() returns (address) envfree

    //aToken.underlyingToken() returns (address) envfree

    // dispatch summaries
    approve(address,uint256) => DISPATCHER(true)
    balanceOf(address) => DISPATCHER(true)
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

/*
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
*/

// TODO: Check that Ptokens are not keys in assetsToPToken?

/**
assetToPToken(asset) != 0 => exists index. isListedAsPlatformToken(asset, index)
 */

definition allowedIncreaseInTokensList() returns uint = 10
    ;

/*
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
    env e;
    require assetToPToken(asset) == aToken;
    require assetInstance == asset;
    //require aToken.underlyingToken() == assetInstance;

    //uint256 underlyingBalanceBefore = underlyingBalance(asset);
    uint256 platformBalanceBefore = checkBalance(asset);

    deposit@withrevert(asset, amount); // TODO with no revert ?
    bool depositReverted = lastReverted;

    uint256 platformBalanceAfter = checkBalance(asset);
    //uint256 underlyingBalanceAfter = underlyingBalance(asset);
    /*assert !depositReverted => ( platformBalanceAfter + underlyingBalanceAfter ==
                                 platformBalanceBefore + underlyingBalanceBefore), "deposit resulted in unexpected balances change";
*/
assert !depositReverted => ( platformBalanceAfter - platformBalanceBefore == amount ),
        "deposit resulted in unexpected balances change";
}

rule integrityOfWithdraw(address recipient, address asset) {
    uint256 amount;
    env e;
    require assetToPToken(asset) == aToken;
    require assetInstance == asset; // assetInstance is DummyERC20A
    require recipient != 0;
    //require aToken.underlyingToken() == assetInstance;
    require aToken.lendingPool() == lendPool.getLendingPool(); // mockAToken.lendingPool = mockAave;
    require recipient != aToken.lendingPool(); // pool != recipient

    uint256 recipientBalanceBefore = assetInstance.balanceOf(e, recipient);
    uint256 platformBalanceBefore = checkBalance(asset);

    withdraw@withrevert(recipient, asset, amount); // TODO with no revert ?
    bool withdrawReverted = lastReverted;

    uint256 platformBalanceAfter = checkBalance(asset);
    uint256 recipientBalanceAfter = assetInstance.balanceOf(e, recipient);

    assert !withdrawReverted => ( platformBalanceBefore - platformBalanceAfter == amount &&
                                  recipientBalanceAfter - recipientBalanceBefore == amount),
           "withdraw resulted in unexpected balances change";
    assert withdrawReverted => ( platformBalanceBefore == platformBalanceAfter &&
                                 recipientBalanceBefore == recipientBalanceAfter),
           "withdraw reverted but the balance/s has/ve changed";
}


rule checkBalanceRule(address asset, method f) {
    env e;
    calldataarg arg;
    require assetToPToken(asset) == aToken;
    require assetInstance == asset;

    uint256 underlyingBalanceBefore = underlyingBalance(asset);
    uint256 platformBalanceBefore = checkBalance(asset);
    f(e, arg);
    uint256 platformBalanceAfter = checkBalance(asset);
    uint256 underlyingBalanceAfter = underlyingBalance(asset);

    assert (platformBalanceAfter +  underlyingBalanceAfter == platformBalanceBefore + underlyingBalanceBefore), "resulted in unexpected balances change";
}


rule checkRemoveTokenRule(address asset, uint256 _assetIndex){
    require assetToPToken(asset) == aToken;
    env e;
    bool isPrivileged = e.msg.sender == governor();
    require isPrivileged;

    uint256 platformBalanceBefore;
    if (assetToPToken(asset) != 0) {
        platformBalanceBefore = checkBalance(asset);
    } else {
        platformBalanceBefore = 0;
    }

    removePToken(e, _assetIndex);

    uint256 platformBalanceAfter;
    if (assetToPToken(asset) != 0) {
        platformBalanceAfter = checkBalance(asset);
    } else {
        platformBalanceAfter = 0;
    }

    assert platformBalanceAfter == platformBalanceBefore, "removePToken resulted in unexpected balances change";
}


rule reversibilityOfDeposit(address asset) {
    // A deposit operation can be inverted, and the funds can be restored.

    uint256 amount;
    require assetToPToken(asset) != 0; // pToken is set

    uint256 platformBalanceBefore = checkBalance(asset);

    deposit@withrevert(asset, amount);
    bool depositReverted = lastReverted;

    withdraw@withrevert(currentContract, asset, amount);
    bool withdrawReverted = lastReverted;

    uint256 platformBalanceAfter = checkBalance(asset);

    assert !depositReverted => ( !withdrawReverted =>
                                 platformBalanceAfter == platformBalanceBefore ),
                                 "withdraw deposited amount resulted in unexpected balances change";
}


// Total asset value is monotonically increasing
rule totalValueIncreasing(address asset, method f) {
    env e;
    calldataarg arg;

    require assetToPToken(asset) == aToken;
    require assetInstance == asset;

    uint256 underlyingBalanceBefore = underlyingBalance(asset);
    uint256 platformBalanceBefore = checkBalance(asset);
    uint256 totalBefore = underlyingBalanceBefore + platformBalanceBefore;

    f(e, arg);

    uint256 platformBalanceAfter = checkBalance(asset);
    uint256 underlyingBalanceAfter = underlyingBalance(asset);
    uint256 totalAfter = underlyingBalanceAfter + platformBalanceAfter;

    assert totalBefore <= totalAfter, "Total asset value has decreased";
}