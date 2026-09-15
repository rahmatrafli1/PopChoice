import fs from "node:fs/promises";
import "dotenv/config";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const requiredVariables = [
  "VITE_OPENAI_API_KEY",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

async function main() {
  const missingVariables = requiredVariables.filter(
    (variable) => !process.env[variable],
  );

  if (missingVariables.length) {
    throw new Error(`Missing in .env: ${missingVariables.join(", ")}`);
  }

  console.log("Environment variables loaded.");

  const source = await fs.readFile(
    new URL("../movies.txt", import.meta.url),
    "utf8",
  );
  const movies = source
    .split(/\r?\n\s*\r?\n/)
    .map(parseMovie)
    .filter(Boolean);

  if (!movies.length) {
    throw new Error("No movies found in movies.txt");
  }

  console.log(`Parsed ${movies.length} movies from movies.txt.`);

  const openai = new OpenAI({
    apiKey: process.env.VITE_OPENAI_API_KEY,
    timeout: 120000,
  });
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  console.log("Requesting embeddings from OpenAI...");
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: movies.map((movie) => movie.content),
  });

  const rows = movies.map((movie, index) => ({
    title: movie.title,
    release_year: movie.releaseYear,
    content: movie.content,
    embedding: embeddingResponse.data[index].embedding,
  }));

  console.log("Writing movies and embeddings to Supabase...");
  const { error } = await supabase
    .from("movies")
    .upsert(rows, { onConflict: "title" })
    .abortSignal(AbortSignal.timeout(120000));

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  console.log(`Seeded ${rows.length} movies with embeddings.`);
}

function parseMovie(block) {
  const lines = block.trim().split(/\r?\n/);
  const metadata = lines.shift()?.trim();
  const description = lines.join(" ").trim();
  const match = metadata?.match(
    /^(.+):\s+(\d{4})\s+\|\s+[^|]+\s+\|\s+[^|]+\s+\|\s+[\d.]+\s+rating$/,
  );

  if (!match || !description) {
    throw new Error(`Invalid movie entry: ${metadata ?? "unknown"}`);
  }

  const [, title, releaseYear] = match;
  return {
    title,
    releaseYear: Number(releaseYear),
    content: `${title}. ${description}`,
  };
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
