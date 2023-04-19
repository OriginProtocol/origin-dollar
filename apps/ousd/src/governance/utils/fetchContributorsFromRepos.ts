async function fetchContributors(repositories) {
  if (!repositories || !repositories.slice) return [];

  const contributorLists = await Promise.all(
    repositories.slice(0, 19).map(async (repository) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_GITHUB}/repos/OriginProtocol/${repository.name}/contributors?per_page=100`,
        {
          headers: {
            authorization: `token ${process.env.GITHUB_API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch ${repository.name} contributors`);
      }
      const json = await response.json();
      return json;
    })
  );

  const list = [];
  contributorLists.forEach((contributorList) => {
    contributorList?.forEach((contributor) => {
      if (!list.some((c) => c.login === contributor.login))
        list.push(contributor);
    });
  });

  return list;
}

export default async function fetchContributorsFromRepos() {
  const reposRes = await fetch(
    `${process.env.NEXT_PUBLIC_GITHUB}/orgs/OriginProtocol/repos?per_page=100`,
    {
      headers: {
        authorization: `token ${process.env.GITHUB_API_KEY}`,
      },
    }
  );

  const repos = await reposRes.json();
  const contributorsRes = await fetchContributors(repos);
  return contributorsRes;
}
