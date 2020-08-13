<script>
  import Menu from "./Menu.svelte";
  import Holdings from "./Holdings.svelte";
  import { activePerson, activePopupMenu } from "./stores.js";

  export let contract = { name: "A Contract" };
  $: name = contract.name;
  let hoverCss = "";
  let dragNestCount = 0;
  let endTimer;

  function handleDrop(e) {
    hoverCss = "";
    activePopupMenu.set({ person: $activePerson, contract: contract });
  }

  function handleDragEnter(ev) {
    hoverCss = "hover";
  }

  function handleDragLeave(e) {
    hoverCss = "";
  }
</script>

<style>
  h3 {
    margin-top: 0px;
  }
  .card {
    border: solid 1px #666;
  }
  div.card.hover * {
    pointer-events: none;
  }
  .avatar {
    float: right;
    width: 32px;
    height: 32px;
    border-radius: 4px;
    margin: auto;
    font-size: 27px;
    background: #962000;
    color: black;
  }
</style>

<div
  class="card {hoverCss}"
  on:drop={handleDrop}
  ondragover="return false"
  on:dragenter={handleDragEnter}
  on:dragleave={handleDragLeave}>
  {#if $activePopupMenu && $activePopupMenu.contract == contract}
    <Menu
      person={$activePopupMenu.person}
      contract={$activePopupMenu.contract} />
  {/if}

  <div>
    <h3>
      {name}
      <div class="avatar" style="text-align: center">{contract.icon}</div>
    </h3>
    <Holdings holdings={contract.holdings}/>
  </div>
</div>
