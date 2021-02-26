rule=${1}
certoraRun ../spec/harnesses/ThreePoolStrategyHarness.sol ../spec/harnesses/DummyERC20A.sol ../spec/harnesses/DummyERC20B.sol ../spec/harnesses/PTokenA.sol \
  --staging \
  --verify ThreePoolStrategyHarness:../spec/threePoolStrategy.spec \
  --cache strategyThreePool \
  --solc solc5.11 \
  --settings -assumeUnwindCond,-b=3,-t=300,-enableStorageAnalysis=true,-ignoreViewFunctions \
  --msg "Strategy ThreePoolStrategy - ${rule} verification" \
  --rule ${rule}