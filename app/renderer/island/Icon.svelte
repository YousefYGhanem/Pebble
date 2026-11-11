<script lang="ts">
  // Line icons on a 24×24 grid, drawn in the current text colour.
  const PATHS: Record<string, string> = {
    read: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h5',
    edit: 'M4 20h4L19 9l-4-4L4 16z M13 7l4 4',
    run: 'M4 6l6 6-6 6 M12 18h8',
    search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z M15.5 15.5L20 20',
    web: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
    task: 'M6 4v16 M6 8h8a4 4 0 0 1 4 4v1 M18 13l-3 3 M18 13l3 3',
    other: 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    jump: 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6',
    history: 'M3 12a9 9 0 1 0 3-6.7 M3 4v4h4 M12 7v5l3 2',
    check: 'M5 12l5 5 9-10',
    close: 'M6 6l12 12 M18 6L6 18',
    home: 'M4 11l8-7 8 7 M6 9.5V20h12V9.5',
    agents: 'M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
    music: 'M9 18V5l11-2v13 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    files: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    clipboard: 'M9 4h6v3H9z M9 5H6v16h12V5h-3 M9 12h6 M9 16h4',
    notes: 'M4 4h16v11l-5 5H4z M15 20v-5h5 M8 9h8 M8 13h4', // a sticky note (the clipboard is the other page shape)
    focus: 'M12 8v5l3 2 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M10 1h4',
    play: 'M7 4l13 8-13 8z',
    pause: 'M7 4h3v16H7z M14 4h3v16h-3z',
    stop: 'M6 6h12v12H6z',
    pin: 'M9 3h6l-1 6 3 3H7l3-3z M12 12v9',
    micoff: 'M9 4a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M5 11a7 7 0 0 0 14 0 M12 18v3 M3 3l18 18',
    keyboard: 'M3 6h18v12H3z M7 10h.01 M11 10h.01 M15 10h.01 M7 14h10',
    battery: 'M3 8h15v8H3z M20 11v2 M6 11h6',
    download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
    next: 'M5 4l11 8-11 8z M19 4v16',
    previous: 'M19 4L8 12l11 8z M5 4v16',
    wifi: 'M2 9a15 15 0 0 1 20 0 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5h.01',
    bluetooth: 'M7 7l10 10-5 4V3l5 4L7 17',
    phone: 'M7 2h10v20H7z M11 18h2',
    trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14',
    settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 2v3 M12 19v3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M2 12h3 M19 12h3 M4.9 19.1L7 17 M17 7l2.1-2.1',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    mic: 'M9 4a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M5 11a7 7 0 0 0 14 0 M12 18v3',
    speaker: 'M4 9h4l5-4v14l-5-4H4z M16 9a4 4 0 0 1 0 6 M19 6a8 8 0 0 1 0 12',
    chat: 'M4 5h16v11H9l-5 4z',
    send: 'M4 12l16-8-6 16-2-7z',
    copy: 'M8 8h12v12H8z M16 8V4H4v12h4',
    plus: 'M12 5v14 M5 12h14',
    volume: 'M4 9h4l5-4v14l-5-4H4z M16 9a4 4 0 0 1 0 6 M19 6a8 8 0 0 1 0 12',
    folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 10h18',
    grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z'
  }
  let { name, size = 14 }: { name: string; size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={PATHS[name] ?? PATHS.other} />
</svg>
