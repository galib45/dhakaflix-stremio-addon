const { addonBuilder } = require("stremio-addon-sdk")
const fs = require("fs");

const lib = JSON.parse(fs.readFileSync("library.json", "utf8"));
const ids = JSON.parse(fs.readFileSync("ids.json", "utf8"));

// imdb_id -> [show, ...]  (a show with several dirs gets several entries)
const byImdb = new Map();
let skipped = 0;
for (const show of lib.shows) {
  const imdb = ids[show.key]?.imdb_id;
  if (!imdb) { skipped++; continue; }
  if (!byImdb.has(imdb)) byImdb.set(imdb, []);
  byImdb.get(imdb).push(show);
}
console.log(`Indexed ${byImdb.size} shows (${skipped} without imdb id)`);

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
const manifest = {
	"id": "community.DhakaFlix",
	"version": "0.0.1",
	"catalogs": [],
	"resources": [
		"stream"
	],
	"types": [
		"series"
	],
	"name": "DhakaFlix",
	"description": "DhakaFlix (SamOnline)",
	"idPrefixes": [
		"tt"
	]
}
const builder = new addonBuilder(manifest)

builder.defineStreamHandler(({ type, id }) => {
  if (type !== "series") return Promise.resolve({ streams: [] });

  const [imdb, season, episode] = id.split(":");
  const shows = byImdb.get(imdb) ?? [];
  const streams = [];

  for (const show of shows) {
    const paths = show.seasons?.[season]?.[episode] ?? [];
    for (const rel of paths) {
      const filename = rel.split("/").pop();
      let title = filename;
      try { title = decodeURIComponent(filename); } catch {}
      streams.push({
        name: "DhakaFlix",
        title,
        url: `${lib.base_url}${show.dir}/${rel}`,
        behaviorHints: { notWebReady: true },
      });
    }
  }

  console.log(`${id} -> ${streams.length} streams`);
  return Promise.resolve({ streams });
});

module.exports = builder.getInterface()
