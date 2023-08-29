import { warn, danger, message } from "danger";

const MINIMUM_REVIEWERS = 2;

const files = [
  ...danger.git.modified_files,
  ...danger.git.created_files,
  ...danger.git.deleted_files,
];
const hasContractChanges = files.some((file) => file.endsWith(".sol"));

if (hasContractChanges) {
  const reviewers = danger.github.reviews.filter(
    (review) => review.state === "APPROVED"
  ).length;

  if (reviewers < MINIMUM_REVIEWERS) {
    warn(`:eyes: This PR needs at least ${MINIMUM_REVIEWERS} reviewers`);
  } else {
    message(`:tada: This PR has ${reviewers} approved reviews`);
  }
}
