# Pankhuri Verma — Events portfolio v2

This package adds the unlisted visual events portfolio at:

`https://www.pankhuriverma.com/events/`

## Upload this folder to the root of `pankhurirk/portfolio`

```text
events/
├── index.html
├── events.css
└── media/
    ├── reading-parade.webp
    ├── reading-parade.mp4
    ├── basingstoke-parade.webp
    ├── basingstoke-parade.mp4
    ├── mehendi-poster.webp
    ├── mehendi-mela.mp4
    ├── computer-club.webp
    └── university-open-day.webp
```

Do not add an Events link to the existing website menu, and do not add this page to `sitemap.xml`.

## Why it remains unlisted

The page includes:

```html
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
```

It is also not linked from the main site navigation. This makes it suitable as a CV-only portfolio URL.

Important: GitHub Pages is public. The page is unlisted rather than password-protected.

## Media optimisation

The supplied PNG images have been converted to WebP for much smaller download sizes. The supplied videos have also been re-encoded for browser playback and faster loading, while preserving the originals outside this package.

## Content updates in this version

- Reading Diwali Parade now has photo + video evidence.
- Basingstoke Diwali Parade now has photo + video evidence.
- Mehendi Mela now has video evidence and a video poster frame.
- University experience now explicitly includes Computer/Technology Club competitions and exhibitions, Open Days, and the 3,000+ attendee Cultural Evening.
- The hero uses a real event photograph rather than the general performance portrait.

## GitHub web upload

The simplest method is to upload the whole `events` folder using GitHub Desktop or your local Git client. If using the GitHub website, create `events/index.html` and `events/events.css`, then upload the files into `events/media/`.

After GitHub Pages deploys, open:

`https://www.pankhuriverma.com/events/`


## Version 3 layout update

- Uses `media/pankhuri-events-hero.webp` as the top-page portrait.
- Selected Experience, What I Manage, and My Edge now use full-width headings.
- Removed the 30/70 section split that left a large blank column on the left.
- What I Manage is distributed across four equal cards on desktop.
- My Edge uses a balanced two-column layout on desktop.
