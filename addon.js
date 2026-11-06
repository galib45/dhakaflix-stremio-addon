const { addonBuilder } = require("stremio-addon-sdk")
const fs = require("fs");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// ---------- series (unchanged) ----------
const lib = readJson("tv-series-library.json");
const ids = readJson("tv-series-ids.json");

const byImdb = new Map();
let skipped = 0;
for (const show of lib.shows) {
  const imdb = ids[show.key]?.imdb_id;
  if (!imdb) { skipped++; continue; }
  if (!byImdb.has(imdb)) byImdb.set(imdb, []);
  byImdb.get(imdb).push(show);
}
console.log(`Indexed ${byImdb.size} shows (${skipped} without imdb id)`);

// ---------- movies ----------
const MOVIE_LIBS = ["hindi-movies-library.json"]; // add more libraries here
const movieByImdb = new Map();
const movieByTmdb = new Map();
const missingIds = [];
let movieCount = 0;

const addTo = (map, key, entry) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(entry);
};

for (const file of MOVIE_LIBS) {
  const mlib = readJson(file);
  for (const movie of mlib.movies) {
    if (movie.imdb_id == null && movie.tmdb_id == null) {
      missingIds.push({ file, title: movie.title, year: movie.year, dir: movie.dir });
      continue;
    }
    const entry = { base_url: mlib.base_url, movie };
    if (movie.imdb_id != null) addTo(movieByImdb, movie.imdb_id, entry);
    if (movie.tmdb_id != null) addTo(movieByTmdb, String(movie.tmdb_id), entry);
    movieCount++;
  }
}

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
	"idPrefixes": [
		"tt", "tmdb:", "kitsu:"
	]
}
const builder = new addonBuilder(manifest)

function movieStreams(entries) {
  const streams = [];
  for (const { base_url, movie } of entries) {
    for (const filename of movie.files) {
      let title = filename;
      try { title = decodeURIComponent(filename); } catch {}
      streams.push({
        name: "DhakaFlix",
        title,
        url: `${base_url}${movie.dir}/${filename}`,
        behaviorHints: { notWebReady: true },
      });
    }
  }
  return streams;
}

function lookupMovie(id) {
  if (id.startsWith("tmdb:")) return movieByTmdb.get(id.slice(5)) ?? [];
  return movieByImdb.get(id) ?? [];
}

function seriesStreams(id) {
  const [imdb, season, episode] = id.split(":");
  const streams = [];
  for (const show of byImdb.get(imdb) ?? []) {
    const paths = show.seasons?.[season]?.[episode] ?? [];
    for (const rel of paths) {
      const filename = rel.split("/").pop();
      let title = filename;
      try { title = decodeURIComponent(filename); } catch {}
      streams.push({
        name: "DhakaFlix",
        description: title,
        url: `${lib.base_url}${show.dir}/${rel}`,
        behaviorHints: { notWebReady: true },
      });
    }
  }
  return streams;
}

builder.defineStreamHandler(({ type, id }) => {
  const streams = type === "movie" ? movieStreams(lookupMovie(id)) : seriesStreams(id);
  console.log(`${type} ${id} -> ${streams.length} streams`);
  return Promise.resolve({ streams });
});

module.exports = builder.getInterface()
