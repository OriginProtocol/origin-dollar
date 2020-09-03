<script>
  import Person from "./Person.svelte";
  import Contract from "./Contract.svelte";
  import Scenarios from "./Scenarios.svelte";
  import TransactionMini from "./TransactionMini.svelte";
  import { people, contracts, transactions } from "./stores.js";
</script>

<style>
  h1 {
    margin-left: 14px;
  }
</style>

<main>
  <h1>Contract Playground</h1>

  <div style="width: 525px; float: left; padding-left:40px;">
    <Scenarios />
    <h3>Transactions</h3>
    <table>
      {#each $transactions as tx}
        <TransactionMini {tx} />
      {/each}
    </table>
  </div>
  {#each $people as person}
    <Person {person} />
  {/each}
  {#each $contracts as contract}
    <Contract {contract} />
  {/each}
</main>
