<script>
  import { scenarios } from "./stores.js";
  import Scenario from "./Scenario.svelte";
  console.log(scenarios);
</script>

<div>
  {#each scenarios as scenario}
    <Scenario {scenario} />
  {/each}
</div>
