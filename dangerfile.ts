import { warn, danger } from "danger";

const MINIMUM_REVIEWERS = 2;

const hasContractChanges = danger.git.modified_files.includes(".sol");

if (hasContractChanges) {
  const reviewers = danger.github.reviews.length;
  if (reviewers < MINIMUM_REVIEWERS) {
    warn(`:eyes: This PR needs at least ${MINIMUM_REVIEWERS} reviewers`);
  }
}
