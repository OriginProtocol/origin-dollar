<script>
  import { activePerson } from "./stores.js";
  import Namebar from "./Namebar.svelte";
  import Holdings from "./Holdings.svelte";

  // At the moment, nothing happens if you drop a person on a person,
  // But the code supports only hovering when over other people, not yourself.

  export let person = { name: "", icon: "👳‍♂️" };
  $: name = person.name;
  $: icon = person.icon;
  let hoverCss = "";
  let dragNestCount = 0;
  let me;

  function handleDrop() {
    hoverCss = "";
  }

  function handleDragEnter(ev) {
    if (ev.dataTransfer.types.includes(`name_${name.toLowerCase()}`)) {
      return false;
    }
    hoverCss = "hover";
  }

  function handleDragLeave(e) {
    hoverCss = "";
  }

  function handleOnDragOver(ev) {
    ev.preventDefault();
  }

  function handleOnDragStart(ev) {
    activePerson.set(person);
    ev.dataTransfer.setData("text/plain", name);
    ev.dataTransfer.setData(`name_${name.toLowerCase()}`, "x");
  }
</script>

<style>
  .card {
    width: 200px;
    float: left;
  }
  .hover {
    background: #962000;
  }

  div.card.hover * {
    pointer-events: none;
  }
</style>

<div
  class="card {hoverCss}"
  on:drop={handleDrop}
  ondragover="return false"
  on:dragenter={handleDragEnter}
  on:dragleave={handleDragLeave}
  on:dragstart={handleOnDragStart}
  draggable="true"
  bind:this={me}>
  <div>
    <Namebar {person} />
    <Holdings holdings={person.holdings}/>
  </div>
</div>
