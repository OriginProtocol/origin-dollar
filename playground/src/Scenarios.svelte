<script>
  import { scenarios } from "./stores.js";
  import Scenario from "./Scenario.svelte";

  let selected = undefined;

  function select(scenario) {
    selected = scenario;
  }
  function back() {
    selected = undefined;
  }
</script>

<div>
  {#if selected}
    <a href="#" on:click={() => back()}>Back</a>
    <Scenario scenario={selected} />
  {:else}
    <h3>Scenarios</h3>
    <ul>
      {#each scenarios as scenario}
        <li>
          <a href="#" on:click={() => select(scenario)}>{scenario.name}</a>
        </li>
      {/each}
    </ul>
  {/if}
</div>
