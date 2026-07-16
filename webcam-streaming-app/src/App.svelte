<script>
  import { onMount, onDestroy } from 'svelte';
  import SplashScreen from './lib/SplashScreen.svelte';
  import ScannerPublisher from './lib/ScannerPublisher.svelte';
  import VideoFeedViewer from './lib/VideoFeedViewer.svelte';
  import { SolaceVideoClient } from './lib/common/solace';
  import { APP_CONFIG } from './lib/common/config';

  const urlParams = new URLSearchParams(window.location.search);
  const urlSessionId = urlParams.get('sessionId');
  const isReadingRoomRoute = window.location.pathname === '/reading-room';

  let currentView = $state(isReadingRoomRoute ? 'readingRoom' : 'splash');
  let solaceReady = $state(false);

  const solaceClient = new SolaceVideoClient(APP_CONFIG.solace);

  onMount(async () => {
    try {
      await solaceClient.connect();
    } catch (error) {
      console.error('App: Failed to connect to Solace:', error);
    } finally {
      solaceReady = true; // unblock UI even on error so viewer can show error state
    }
  });

  onDestroy(() => solaceClient.disconnect());
</script>

{#if currentView === 'splash'}
  <SplashScreen
    onScanner={() => currentView = 'scanner'}
    onReadingRoom={() => currentView = 'readingRoom'}
  />
{:else if currentView === 'scanner'}
  {#if solaceReady}
    <ScannerPublisher {solaceClient} onBack={() => currentView = 'splash'} />
  {:else}
    <div class="min-h-screen bg-gradient-to-br from-gehc-bg via-white to-gehc-bg flex items-center justify-center">
      <div class="text-center space-y-4">
        <div class="w-16 h-16 border-4 border-gehc-purple/30 border-t-gehc-purple rounded-full animate-spin mx-auto"></div>
        <p class="text-gehc-navy font-medium">Connecting to Solace…</p>
      </div>
    </div>
  {/if}
{:else if currentView === 'readingRoom'}
  {#if solaceReady}
    <VideoFeedViewer {solaceClient} onBack={() => currentView = 'splash'} sessionId={urlSessionId} />
  {:else}
    <div class="min-h-screen bg-gradient-to-br from-gehc-bg via-white to-gehc-bg flex items-center justify-center">
      <div class="text-center space-y-4">
        <div class="w-16 h-16 border-4 border-gehc-purple/30 border-t-gehc-purple rounded-full animate-spin mx-auto"></div>
        <p class="text-gehc-navy font-medium">Connecting to Solace…</p>
      </div>
    </div>
  {/if}
{/if}
