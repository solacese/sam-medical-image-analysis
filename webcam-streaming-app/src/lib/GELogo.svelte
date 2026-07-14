<script>
  // Stylized recreation of the GE HealthCare "Compassion Purple" monogram + wordmark.
  // (Not the official trademarked artwork — a themed approximation for this demo.)
  let { size = 44, wordmark = true, color = '#7B61FF', textColor = '#1F2A44' } = $props();
</script>

<div class="flex items-center gap-2.5 select-none">
  <!-- GE monogram -->
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="GE HealthCare"
    class="shrink-0"
  >
    <circle cx="50" cy="50" r="47" fill="none" stroke={color} stroke-width="4" />
    <circle cx="50" cy="50" r="40" fill="none" stroke={color} stroke-width="1.5" opacity="0.5" />
    <text
      x="50"
      y="50"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="'Poppins', Georgia, serif"
      font-style="italic"
      font-weight="700"
      font-size="42"
      fill={color}
    >ge</text>
  </svg>

  {#if wordmark}
    <div class="leading-none">
      <div class="font-display font-bold text-[1.05rem] tracking-tight" style="color: {textColor};">
        GE <span style="color: {color};">HealthCare</span>
      </div>
      <div class="text-[0.6rem] font-medium tracking-[0.2em] uppercase" style="color: {color}; opacity: 0.7;">
        Precision Imaging
      </div>
    </div>
  {/if}
</div>
