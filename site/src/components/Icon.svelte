<script module lang="ts">
  // Pebble's own line icons (24 × 24, drawn with the current colour). Content files pick them by name.
  export const ICONS: Record<string, string> = {
    agents: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    answer: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 4v-4h0.5A2.5 2.5 0 0 1 4 13.5z"/><path d="M8.5 10.2l2.2 2.2 4.6-4.6"/>',
    gauge: '<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="M12 13l4-4.5"/><circle cx="12" cy="13.5" r="1.2"/>',
    pip: '<path d="M5 13.5C5 8.8 8.1 6.5 12 6.5s7 2.3 7 7c0 3.6-2.7 5-7 5s-7-1.4-7-5z"/><rect x="7.6" y="10.6" width="8.8" height="4.4" rx="2.2"/><path d="M12 3.2l1.2 1.5L12 6.2l-1.2-1.5z"/>',
    home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V19h12V9.5"/><path d="M10 19v-5h4v5"/>',
    music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
    folder: '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    clipboard: '<rect x="5.5" y="5" width="13" height="15.5" rx="2"/><path d="M9 5V3.8h6V5"/><path d="M9 10.5h6M9 14h6M9 17.5h3.5"/>',
    notes: '<path d="M5.5 4h13v11l-5 5h-8z"/><path d="M13.5 20v-5h5"/><path d="M8.5 8.5h7M8.5 12h4"/>',
    timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V10M9.5 3h5"/><path d="M18 7l1.5-1.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    plug: '<path d="M9 3.5v4M15 3.5v4"/><path d="M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 16v4.5"/>',
    chat: '<path d="M4.5 12a7.5 7 0 1 1 3.4 5.9L4 19.5l1.3-3.6A6.7 6.7 0 0 1 4.5 12z"/><path d="M9 11.5h.01M12 11.5h.01M15 11.5h.01" stroke-width="2.4"/>',
    peek: '<rect x="3.5" y="4" width="17" height="6" rx="3"/><path d="M6.5 14h11M8.5 18h7"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.9 0-1.4-1.3-1.7-1.3-2.9 0-1 .8-1.7 1.8-1.7h2.1a3.9 3.9 0 0 0 3.9-3.9C20.5 6.9 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10.5" cy="7.3" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M9.3 10h.01M12.6 10h.01M15.9 10h.01M18 10h.01M7.5 14h9" stroke-width="2"/>',
    leaf: '<path d="M5 19c0-8 5-13 14.5-13.5C19 15 14 19.5 7 19.5"/><path d="M5 19.5c3-4 6-6.5 9.5-8.5"/>',
    shield: '<path d="M12 3.2l7 2.6v5.4c0 4.6-3 8-7 9.6-4-1.6-7-5-7-9.6V5.8z"/><path d="M8.8 12l2.2 2.2 4.2-4.4"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5z"/>',
    terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15H17"/>',
    code: '<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14"/>',
    prompt: '<path d="M5 7l5 5-5 5M12 17h7"/>',
    history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/><path d="M12 8v4.5l3 2"/>',
    undo: '<path d="M9 7L4.5 11.5 9 16"/><path d="M4.5 11.5H15a4.5 4.5 0 0 1 0 9h-3"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    sparkle: '<path d="M12 3.5l2 5.5 5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2z"/>',
    line: '<path d="M4 12h3M10.5 12h3M17 12h3"/><path d="M7 7.5h10" opacity=".45"/>',
    confetti: '<path d="M4.5 20l4-11 7 7z"/><path d="M14 4.5l.5 2M18.5 6l-1.5 1.5M19.5 10.5l-2 .5M11.5 7.5c1-1 1-2.5 0-3.5M16.5 12.5c1-1 2.5-1 3.5 0"/>',
    trophy: '<path d="M8 4.5h8v5a4 4 0 0 1-8 0z"/><path d="M8 6.5H5.5a2.5 2.5 0 0 0 2.6 3.4M16 6.5h2.5a2.5 2.5 0 0 1-2.6 3.4"/><path d="M12 13.5v3.5M8.5 20h7M9.5 17h5"/>',
    chip: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
    gamepad: '<path d="M7 7.5h10a4 4 0 0 1 3.9 4.8l-.8 4a2.2 2.2 0 0 1-3.8 1L14.5 15h-5l-1.8 2.3a2.2 2.2 0 0 1-3.8-1l-.8-4A4 4 0 0 1 7 7.5z"/><path d="M8 10.5v3M6.5 12h3M15.5 11h.01M17.5 13h.01" stroke-width="1.9"/>',
    flame: '<path d="M12 20.5c-3.6 0-6-2.4-6-5.6 0-3.4 2.6-5.1 3.6-8.4 1.9 1.2 2.4 3 2.4 4.3 1-.6 1.6-1.6 1.8-2.8 2 1.6 4.2 3.9 4.2 6.9 0 3.2-2.4 5.6-6 5.6z"/>',
    stethoscope: '<path d="M6 3.5v5a4 4 0 0 0 8 0v-5"/><path d="M10 12.5v2a4.5 4.5 0 0 0 9 0V12"/><circle cx="19" cy="10" r="2"/>',
    play: '<path d="M7.5 5v14l11-7z"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9"/><path d="M19.5 4.5V9H15"/>',
    hand: '<path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10M11 10V4.5a1.5 1.5 0 0 1 3 0V10M14 10V5.5a1.5 1.5 0 0 1 3 0v7.5a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.8-2.4L3.5 15a1.5 1.5 0 0 1 2.4-1.8L8 15.5"/>',
    bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5h4"/>',
    backup: '<path d="M5 7.5h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M4 4.5h16v3H4zM10 11.5h4"/>',
    drop: '<path d="M12 3.5c3 3.8 6 7.1 6 10.5a6 6 0 0 1-12 0c0-3.4 3-6.7 6-10.5z"/>',
    stretch: '<circle cx="12" cy="4.8" r="1.8"/><path d="M5 8.5l7 1.5 7-1.5M12 10v5l-3 5.5M12 15l3 5.5"/>',
    moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    chart: '<path d="M4.5 19.5h15M7 16v-4M11 16V8M15 16v-6M19 16V5"/>',
    speaker: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    caps: '<path d="M12 4.5L5 12h4v4h6v-4h4z"/><path d="M9 19.5h6"/>',
    mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/><path d="M4 4l16 16"/>',
    bolt: '<path d="M13 3L5.5 13.5H11L10 21l7.5-10.5H12z"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
    check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    bag: '<path d="M5 8.5h14l-1 11a1.5 1.5 0 0 1-1.5 1.4h-9A1.5 1.5 0 0 1 6 19.5z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
    github: '<path d="M9 19.5c-4 1.3-4-2-5.5-2.5M15 21.5v-3.4a3 3 0 0 0-.8-2.3c2.8-.3 5.8-1.4 5.8-6.2a4.8 4.8 0 0 0-1.3-3.3 4.5 4.5 0 0 0-.1-3.3s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6.2 0C6.6 2.7 5.6 3 5.6 3a4.5 4.5 0 0 0-.1 3.3 4.8 4.8 0 0 0-1.3 3.3c0 4.8 3 5.9 5.8 6.2a3 3 0 0 0-.8 2.3v3.4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  }
</script>

<script lang="ts">
  let { name, size = 20 }: { name: string; size?: number } = $props()
</script>

<svg class="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  {@html ICONS[name] ?? ICONS.sparkle}
</svg>

<style>
  .icon { flex: none; display: block; }
</style>
