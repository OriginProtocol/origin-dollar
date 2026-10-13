import { action, types } from "../lib/action";

const SQD_API = "https://cloud.sqd.dev/api/v1";
const POLL_INTERVAL_MS = 15_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sqdApi(
  token: string,
  method: "GET" | "POST",
  path: string
): Promise<any> {
  const res = await fetch(`${SQD_API}${path}`, {
    method,
    headers: { authorization: `token ${token}` },
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `SQD API ${method} ${path} failed ${res.status}: ${body?.message ?? ""}`
    );
  }
  return body.payload;
}

action({
  name: "restartSquid",
  description:
    "Restart a squid on SQD Cloud (default origin-squid:prod) and wait for it to come back up",
  chains: [1],
  params: (t) => {
    t.addOptionalParam("org", "SQD organization", "origin", types.string);
    t.addOptionalParam("squid", "Squid name", "origin-squid", types.string);
    t.addOptionalParam("tag", "Squid tag", "prod", types.string);
    t.addOptionalParam(
      "timeoutMinutes",
      "Fail if the restart has not finished within this many minutes",
      30,
      types.int
    );
  },
  run: async ({ log, args }) => {
    const token = process.env.SQD_API_TOKEN;
    if (!token) throw new Error("SQD_API_TOKEN not set");

    const { org, squid, tag } = args;
    const ref = `${org}/${squid}:${tag}`;

    const deployment = await sqdApi(
      token,
      "POST",
      `/orgs/${org}/squids/${squid}:${tag}/restart`
    );
    log.info(`Restart requested for ${ref}, deployment ${deployment.id}`);

    // Same completion rule as `sqd restart`: done at status OK, failed once
    // `failed` is anything other than NO. Throwing fails the Talos run, which
    // the Talos alert loop reports to the ops-alerts channel.
    const deadline = Date.now() + args.timeoutMinutes * 60_000;
    let lastStatus: string | undefined;
    while (Date.now() < deadline) {
      const d = await sqdApi(
        token,
        "GET",
        `/orgs/${org}/deployments/${deployment.id}`
      );
      if (d.status !== lastStatus) {
        log.info(`Deployment ${deployment.id} status: ${d.status}`);
        lastStatus = d.status;
      }
      if (d.failed && d.failed !== "NO") {
        throw new Error(
          `Restart of ${ref} failed (deployment ${deployment.id}, status ${d.status}, failed ${d.failed})`
        );
      }
      if (d.status === "OK") {
        log.info(`Squid ${ref} restarted`);
        return;
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Restart of ${ref} did not finish within ${args.timeoutMinutes} minutes (deployment ${deployment.id}, last status ${lastStatus})`
    );
  },
});
