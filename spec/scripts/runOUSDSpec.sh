certoraRun ../spec/harnesses/OUSDHarness.sol --verify OUSDHarness:../spec/ousd.spec --solc solc5.11 --settings -useNonLinearArithmetic,-t=300,-ignoreViewFunctions,-s=cvc4 --cloud --msg "OUSD NLA"
