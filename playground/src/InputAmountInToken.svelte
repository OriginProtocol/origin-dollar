<script>
  export let param;
  export let value;
  const changeHandler = (e) => {
    value = e.target.value + param.token;
  };
</script>

<input
  placeholder={param.name}
  type="text"
  style="width:75px;"
  on:change={changeHandler} />
<span>{param.token}</span>
