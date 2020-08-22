<script>
  import Person from "./Person.svelte";
  import Contract from "./Contract.svelte";
  import Scenarios from "./Scenarios.svelte";
  import { people, contracts } from "./stores.js";
</script>

<style>
  h1 {
    margin-left: 14px;
  }
</style>

<main>
  <h1>Contract Playground</h1>
  

  {#each $people as person}
    <Person {person} />
  {/each}
  {#each $contracts as contract}
    <Contract {contract} />
  {/each}

  <Scenarios/>

</main>

