strategy=${1}
../spec/scripts/runStrategy.sh $strategy uniqueAssetsInList;
../spec/scripts/runStrategy.sh $strategy assetInListIsSupported;
../spec/scripts/runStrategy.sh $strategy length_lemma;
../spec/scripts/runStrategy.sh $strategy lengthChangeIsBounded;
../spec/scripts/runStrategy.sh $strategy supportedAssetIsInList;
