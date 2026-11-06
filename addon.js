const { addonBuilder } = require("stremio-addon-sdk")
const fs = require("fs");

const lib = JSON.parse(fs.readFileSync("tv-series-library.json", "utf8"));
const ids = JSON.parse(fs.readFileSync("tv-series-ids.json", "utf8"));

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
	"version": "0.0.2",
	"catalogs": [],
	"resources": [
		"stream"
	],
	"types": [
		"series", "movie"
	],
	"name": "dhakaflix",
	"description": "DhakaFlix (SamOnline)",
	// "idPrefixes": [
	// 	"tmdb:"
	// ]
}
const builder = new addonBuilder(manifest)

builder.defineStreamHandler(({ type, id }) => {
  console.log(type, id);
  if (type == "movie" && id == "tmdb:14395") return Promise.resolve({
    streams: [
      {
        name: "DhakaFlix",
        title: "Kabhi Alvida Naa Kehna (2006) Hindi 1080p BluRay x265 HEVC AAC 5.1 MSubs -Natty.mkv",
        url: "http://172.16.50.14/DHAKA-FLIX-14/Hindi%20Movies/%282006%29/Kabhi%20Alvida%20Naa%20Kehna%20%282006%29%201080p/Kabhi%20Alvida%20Naa%20Kehna%20%282006%29%20Hindi%201080p%20BluRay%20x265%20HEVC%20AAC%205.1%20MSubs%20-Natty.mkv",
        behaviorHints: { notWebReady: true },
      }
  ] });

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
        title: `${title}\ndek ki lixi`,
        url: `${lib.base_url}${show.dir}/${rel}`,
        behaviorHints: { notWebReady: true },
      });
    }
  }

  console.log(`${id} -> ${streams.length} streams`);
  return Promise.resolve({ streams });
});

module.exports = builder.getInterface()
