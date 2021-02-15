P=${1}
SRC=${2}
# strategies AaveStrategy
# strategies CompoundStrategy
# strategies ThreePoolStrategy
sed "s/PATH/${P}/g; s/SRC/${SRC}/g" ../spec/harnesses/ReentrancyHarnessTemplate.sol > ReentrancyHarness.sol
certoraRun.py ReentrancyHarness.sol --verify ReentrancyHarness:../spec/reentrancyStrategy.spec \
  --solc solc5.11 \
  --cache reentrancy \
  --settings -assumeUnwindCond,-b=2,-t=300 \
  --cloud --msg "reentrancy - ${SRC}"