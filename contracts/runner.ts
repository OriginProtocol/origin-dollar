import { runContainer } from "@talos/client";

await runContainer({
  product: "origin-dollar",
  baseUrl: process.env.RUNNER_BASE_URL ?? "http://origin-dollar:8080",
  workdir: "/app",
});
