# The website's words

Every word, feature, link and screenshot on the site comes from two files with the same shape:
`en.ts` (English) and `ar.ts` (Arabic). The types are in `types.ts`. `npm test` fails when the two differ in shape,
so a feature added in one language cannot be forgotten in the other.

## Add a feature

1. In `en.ts`, copy one entry of `features` and paste it where it should appear on the page.
2. Change `id` (the #anchor, unique), `icon`, `kicker`, `title`, `text` and `points`.
3. Optional:
   - `shots`: real captures by file name without `.png`, from `docs/screens` or `docs/store`
     (`{ src: 'page-music', alt: '…', h: 272 }`; `h` = how many of the capture's 480 px hold the island;
     without `h` the whole capture shows: then add `size: [width, height]` when it is not 824 × 480).
   - `live`: a live demo: `status`, `usage`, `pip`, `peeks`, `themes`, `keys`, `chat` or `lang`
     (some read `chips`: moods, theme ids, notices, keys or chat lines; see the existing entries).
   - `mood`: how the little Pip in the corner feels while the section is on screen.
   - With neither `shots` nor `live`, the section shows its icon large instead.
4. Do the same in `ar.ts`, in the same place, with the same `id`, `icon`, `shots`, `live`, `mood` and chip ids.

Icons: the names in `site/src/components/Icon.svelte` (add one there as a 24 × 24 line SVG).

## Add a small feature

Copy an entry of `more.items` (`icon`, `title`, `text`) in both files.

## Add a section

Add its words to `types.ts` (`Content`), both language files, then a component in `site/src/components`
that reads them from `site.c` and a line for it in `site/src/App.svelte`.

## Run it

`npm run site:dev` (live) and `npm run site:build` (into `site/dist`, served at /Pebble/).
