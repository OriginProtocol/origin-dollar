<script>
  import Namebar from "./Namebar.svelte";
  import { activePopupMenu, handleTx } from "./stores.js";
  export let person;
  export let contract;

  let activeAction;
  let values = {};

  function close() {
    activePopupMenu.set();
  }

  function doAction() {
    handleTx(
      contract,
      person,
      activeAction,
      (activeAction.params || []).map((x) => x.lastValue)
    );
    close();
  }

  function setActiveAction(action) {
    activeAction = action;
    for (const param of action.params || []) {
      param.lastValue = undefined;
    }
  }
</script>

<style>
  button:hover {
    border-color: rgb(34 37 42);
  }
  input,
  select,
  button {
    box-sizing: border-box;
    padding: 5px 10px;
    border: solid 1px #999;
    border-radius: 4px;
    background: white;
    width: 100%;
    margin-top: 9px;
  }
  .menu h3 {
    border-bottom: solid 1px #ddd;
    margin-top: -17px;
    color: #962000;
    padding: 4px;
  }
  .btn-primary {
    background-color: #226cff;
    border: solid 1px #226cff;
    color: aliceblue;
  }
  .closer {
    position: absolute;
    top: 0px;
    right: 0px;
    display: inline;
    width: 24px;
    height: 24px;
    color: grey;
    text-decoration: none;
  }
</style>

<div class="menu">
  <a href="#" on:click={close} class="closer">x</a>
  <Namebar {person} />
  <h3 style="text-align:right">↳ {contract.name} Contract</h3>
  {#if activeAction == undefined}
    {#each contract.actions as action}
      <button on:click={() => setActiveAction(action)}>{action.name}</button>
    {/each}
  {:else}
    {#each activeAction.params || [] as param}
      <input
        name={param.name}
        placeholder={param.name}
        bind:value={param.lastValue} />
      <br />
    {/each}
    <p style="margin-left: auto; width:50%">
      <button class="btn btn-primary" on:click={doAction}>
        {activeAction.name}
      </button>
    </p>
  {/if}
</div>
