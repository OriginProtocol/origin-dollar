## HARDHAT local checkout tips

In order to have a local checkout of Hardhat (for debug purposes lets say) one needs to:
- Git clone hardhat locally -> lets say: `dollar/dependancies/hardhat` And switch to correct tag
- After altering code in hardhat-core or any other package run: `cd ../dependancies/hardhat/ && yarn run build && cd - &&  yarn remove hardhat && rm -rf node_modules/.bin/hardhat && yarn add file:./../dependancies/hardhat/packages/hardhat-core --dev && yarn run node:fork` Adjust the command if the package being altered is not hardhat-core

### why is this necessary:
- yarn run build compiles the hardhat typescript files to javascript files
- only managed to get it working by removing hardhat project dependency and re-adding it. And yarn / npm link command didn't get picked up by npx. So project is added using yarn local file option -> file:/path/to/repo
- and node_modules/.bin/hardhat needs to get deleted because that is where npx has its compile cache. And typescript compilation wasn't always triggered by npx when it should be
- it is good to use the --no-install npx parameter. Npx has this "cool" feature where dependencies that it can not resolve (like yarn links for example) get downloaded on the fly. With --no-install npx won't attempt any downloads.