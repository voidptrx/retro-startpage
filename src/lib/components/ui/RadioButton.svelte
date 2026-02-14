<script>
    let { group = $bindable(), value, children } = $props()

    let isChecked = $derived(group === value)
</script>

<label>
    <input type="radio" bind:group {value} />
    <span class="radio-indicator">
        {#if isChecked}
            [<span class="radio-x">x</span>]
        {:else}
            [ ]
        {/if}
    </span>
    <span class="radio-content">
        {@render children?.()}
    </span>
</label>

<style>
    label {
        display: block;
        cursor: pointer;
    }

    label input[type='radio'] {
        display: none;
    }

    .radio-indicator {
        color: var(--txt-3);
    }

    .radio-x {
        color: var(--txt-2);
    }

    label:hover .radio-indicator {
        color: var(--txt-2);
    }
</style>
