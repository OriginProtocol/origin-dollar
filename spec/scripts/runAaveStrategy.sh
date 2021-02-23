strategy='AaveStrategy'
rule=${1}
certoraRun contracts/strategies/${strategy}.sol contracts/mocks/MockAave.sol contracts/mocks/MockAToken.sol ../spec/harnesses/DummyERC20A.sol ../spec/harnesses/DummyERC20A2.sol \
  --link MockAToken:underlyingToken=DummyERC20A \
  --staging \
  --verify ${strategy}:../spec/aaveStrategy.spec \
  --cache strategy \
  --solc solc5.11 \
  --settings -assumeUnwindCond,-b=2,-t=300,-enableStorageAnalysis=true \
  --msg "Strategy ${strategy}-${rule} verification" \
  --rule ${rule}
#  --link MockAave:pool=DummyERC20A2 \