using ReentrancyHarness as harness

methods {
    isEnteredState() returns bool envfree
}

definition isPrivilegedFunction(uint256 selector) returns bool =
    selector == setPTokenAddress(address,address).selector ||
    selector == transferToken(address,uint256).selector ||
    selector == claimGovernance().selector ||
    selector == 0x790fcf9f /* initialize(address,address,address,address[],address[]).selector */ ||
    selector == removePToken(uint256).selector ||
    selector == setRewardTokenAddress(address).selector ||
    selector == setRewardLiquidationThreshold(uint256).selector ||
    selector == transferGovernance(address).selector ||
    selector == 0xad1728cb || /* safeApproveAllTokens.selector */ // compound only
    selector == 0xee01555d /* initialize(address,address,address,address[],address[],address,address)*/ // 3Pool only
    ;

definition allowedWithinACallback(uint256 selector) returns bool =
    false
	;


/*
 * Checks which methods have a non reverting path within a callback.
 * Will exclude from the check view functions and privileged functions.
 */
rule runnableAsCallbackForCI(method f) {
    require harness.isEnteredState();
    env e;

    calldataarg arg;
    f@norevert(e, arg);

    // if this section is not reachable this means the combination of not reverting and being in a callback is impossible.
    // thus f cannot be run in a callback and thus have the guard on

    // we want to print a unique message depending on the reason we were successful to run the function
    if (f.isView) {
        require false; // The function is a view function that can be invoked within a callback
    } else if (isPrivilegedFunction(f.selector)) {
        require false; // The function is a privileged function that can be invoked within a callback
    } else if (allowedWithinACallback(f.selector)) {
        require false; // The function is allowed within a callback
    }

    assert false, "The function can be executed within a callback";
}


/*
 * Checks which methods have a non reverting path within a callback.
 * Prints a matching assertion messages for "ok callbacks"
 */
/*rule runnableAsCallback(method f) {
    require harness.isEnteredState();
    env e;

    calldataarg arg;
    f@norevert(e, arg);

    // if this section is not reachable this means the combination of not reverting and being in a callback is impossible.
    // thus f cannot be run in a callback and thus have the guard on

    // we want to print a unique message depending on the reason we were successful to run the function
    if (f.isView) {
        assert false, "The function is a view function that can be invoked within a callback";
    } else if (isPrivilegedFunction(f.selector)) {
        assert false, "The function is a privileged function that can be invoked within a callback";
    } else if (allowedWithinACallback(f.selector)) {
        assert false, "The function is allowed within a callback";
    }

    assert false, "The function can be executed within a callback";
}*/
