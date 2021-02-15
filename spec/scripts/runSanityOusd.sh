certoraRun contracts/token/OUSD.sol \
  --verify OUSD:../spec/sanity.spec \
  --solc solc5.11 \
  --settings -t=300 \
  --staging origin1 --msg "OUSD Sanity"