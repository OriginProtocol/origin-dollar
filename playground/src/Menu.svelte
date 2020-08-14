<script>
  import Namebar from "./Namebar.svelte";
  import InputAmountInToken from "./InputAmountInToken.svelte"
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
  h3 {
    border-bottom: solid 1px #ddd;
    margin-top: -17px;
    color: #962000;
    padding: 4px;
    text-align: right;
  }
  h3.action{
    color:black;
    border-bottom: none;
    margin-bottom: 0px;
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
    <h3 class="action">{activeAction.name}</h3>
    {#each activeAction.params || [] as param}
      {#if param.token != undefined}
        <InputAmountInToken param={param} bind:value={param.lastValue} />
      {:else}
        <input
        name={param.name}
        placeholder={param.name}
        bind:value={param.lastValue} />
      {/if}
      <br />
    {/each}
    <p style="margin-left: auto; width:50%">
      <button class="btn btn-primary" on:click={doAction}>
        {activeAction.name}
      </button>
    </p>
  {/if}
</div>
