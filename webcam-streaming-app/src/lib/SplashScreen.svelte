<script>
  import { onMount } from 'svelte';
  import { SESSION_ID_ENABLED, DEMO_MODE } from './common/config';
  import GELogo from './GELogo.svelte';

  let { onScanner, onReadingRoom } = $props();
  let qrCodeDataUrl = $state(null);

  onMount(async () => {
    const url = `${window.location.origin}/reading-room`;
    const QRCode = await import('qrcode').catch(() => null);
    if (QRCode) {
      qrCodeDataUrl = await QRCode.default.toDataURL(url, {
        width: 200, margin: 1, color: { dark: '#3B2A8C', light: '#ffffff' }
      });
    }
  });
</script>

<div class="fixed inset-0 bg-gradient-to-br from-gehc-purple-deep via-gehc-ink to-gehc-navy z-50 overflow-hidden flex flex-col">

  <!-- Ambient rings backdrop -->
  <div class="absolute inset-0 opacity-30 pointer-events-none flex items-center justify-center">
    <div class="w-[42rem] h-[42rem] rounded-full border border-gehc-purple-light/40 animate-pulse"></div>
    <div class="absolute w-[30rem] h-[30rem] rounded-full border border-gehc-purple-light/30"></div>
    <div class="absolute w-[18rem] h-[18rem] rounded-full border border-gehc-purple-light/20"></div>
  </div>

  <!-- Top brand -->
  <div class="relative z-10 pt-10 text-center">
    <div class="flex justify-center">
      <GELogo size={64} color="#A594FF" textColor="#ffffff" />
    </div>
    <h1 class="mt-6 text-3xl md:text-5xl font-display font-bold text-white drop-shadow-2xl tracking-tight">
      MRI Live Streaming
    </h1>
    <p class="mt-2 text-sm text-gehc-purple-light/80 font-medium tracking-[0.25em] uppercase">
      Real-time imaging over Solace PubSub+
    </p>
    {#if DEMO_MODE}
      <span class="inline-block mt-3 px-3 py-1 rounded-full bg-gehc-purple/30 border border-gehc-purple-light/40 text-gehc-purple-light text-xs font-semibold tracking-widest">DEMO MODE</span>
    {/if}
  </div>

  <!-- Cards -->
  <div class="relative z-10 flex-1 flex items-center justify-center px-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl w-full">

      <!-- Scanner Console -->
      <button
        onclick={() => onScanner?.()}
        class="group text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gehc-purple-light/60 backdrop-blur-sm rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_0_40px_rgba(123,97,255,0.3)]"
      >
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-gehc-purple to-gehc-purple-deep flex items-center justify-center mb-4">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 class="text-white font-display font-bold text-lg mb-1">Scanner Console</h2>
        <p class="text-white/60 text-sm leading-relaxed">Capture the MRI scanner feed and publish live frames to Solace for remote viewing.</p>
        <span class="inline-flex items-center gap-1.5 mt-4 text-gehc-purple-light font-semibold text-sm group-hover:gap-2.5 transition-all">
          Start streaming
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg>
        </span>
      </button>

      <!-- Reading Room -->
      <button
        onclick={() => onReadingRoom?.()}
        class="group text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gehc-purple-light/60 backdrop-blur-sm rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_0_40px_rgba(123,97,255,0.3)]"
      >
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-gehc-purple to-gehc-purple-deep flex items-center justify-center mb-4">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 class="text-white font-display font-bold text-lg mb-1">Reading Room</h2>
        <p class="text-white/60 text-sm leading-relaxed">Subscribe to a scanner's Solace feed and watch the live MRI stream from anywhere.</p>
        {#if qrCodeDataUrl}
          <img src={qrCodeDataUrl} alt="QR code for reading room" class="w-16 h-16 rounded-lg border border-white/10 mt-3" />
        {/if}
        <span class="inline-flex items-center gap-1.5 mt-4 text-gehc-purple-light font-semibold text-sm group-hover:gap-2.5 transition-all">
          Open viewer
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg>
        </span>
      </button>

    </div>
  </div>

  <!-- Footer -->
  <div class="relative z-10 pb-6 text-center text-white/30 text-xs">
    Powered by Solace PubSub+ · GE HealthCare themed demo
  </div>
</div>
