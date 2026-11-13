# Cybersecurity Forum watch page

Static GitHub Pages collection at https://decentricity.github.io/cybersecuritypanel/.

- `videos.json` is the ordered playlist with summaries and original source ranges.
- `media/` contains the 14 web MP4s; the download button serves the same selected file.
- `thumbnails/` contains topic-titled video stills.
- `captions/` contains English YouTube auto-captions retimed to each edit, including joined Q&A sections. Recognition errors remain in the original captions.
- `clip-index.md` contains source timestamp links and edit ranges.

Videos are scaled proportionally to 1280×720 and encoded with H.264 (`veryfast`, CRF 28, maxrate 800k, bufsize 1600k, GOP 50), stereo AAC at 80k, and MP4 fast-start. Original 1080p exports are retained locally outside this repository.

The page needs no build step. Serve this directory over HTTP for local preview. It loads only the selected video with metadata preload; other playlist entries load their thumbnails. Direct chapter links use the filename stem as the URL hash. Auto-next stops at the final chapter.
