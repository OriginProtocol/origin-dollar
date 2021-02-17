strategy=${1}
certoraRun contracts/strategies/${strategy}.sol ../spec/harnesses/DummyERC20A.sol ../spec/harnesses/DummyERC20B.sol \
  --verify ${strategy}:../spec/strategy.spec \
  --cache strategy \
  --solc solc5.11 \
  --settings -assumeUnwindCond,-b=2,-t=300 \
  --msg "Strategy ${strategy} verification"