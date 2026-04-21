<script lang="ts">
	import { loadTechStack } from '$lib/runtime/tech-stack';
	import { onMount } from 'svelte';

    interface Props {
        width: number;
        height: number;
        noiseScale: number;
    }

    let { width, height, noiseScale }: Props = $props();

    let hostElement = $state<HTMLElement | null>(null);
    let isReady = $state(false);
    let errorMessage = $state('');

    let voronoi:any = null;

    $effect(()=>{
        if (isReady && voronoi) {
            updatePixiRender(width, height, noiseScale);
        }
    });

    // $effect(() => {
    //     if (exportRequested)
    // })

  function updatePixiRender(width: number, height: number, noiseScale: number) {
    if(!voronoi) return;
    voronoi.renderer.resize(width, height);
    voronoi.updateNoiseScale(noiseScale);
  }

  onMount(async()=>{
    let disposed = false;

    void (async()=>{
        try{
            const PIXI = (await loadTechStack('pixi')) as typeof import('pixi.js');
            if (disposed || !hostElement) return;
        } catch(e){
            errorMessage = 'Failed to load Pixi.js library.';
            console.error(e);
            return;
        }
    })
  })


</script>