// Hardhat injects `hre` into the global scope when tasks/scripts execute,
// so action files reference it without importing. Importing the runtime
// module directly (e.g. `import hre from "hardhat"`) hits HH9 because
// Hardhat can't be initialized while its config is being defined.
//
// This declaration types the runtime global. The side-effect import of
// hardhat-deploy-ethers activates its module augmentation on
// HardhatRuntimeEnvironment so `hre.ethers.getContract(name)` is typed.
import "hardhat-deploy-ethers/internal/type-extensions";

import type { HardhatRuntimeEnvironment } from "hardhat/types";

declare global {
  const hre: HardhatRuntimeEnvironment;
}

export {};
