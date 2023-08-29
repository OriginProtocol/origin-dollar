import { warn, danger } from "danger";

const MINIMUM_REVIEWERS = 2;

const files = [
  ...danger.git.modified_files,
  ...danger.git.created_files,
  ...danger.git.deleted_files,
];
const hasContractChanges = files.some((file) => file.endsWith(".sol"));

if (hasContractChanges) {
  const reviewers = danger.github.reviews.length;
  if (reviewers < MINIMUM_REVIEWERS) {
    warn(`:eyes: This PR needs at least ${MINIMUM_REVIEWERS} reviewers`);
  }
}
