import { openai, supabase } from "./config.js";
import movies from "./content.js";

const app = document.querySelector("body");
const state = { view: "form", loading: false, recommendation: null, error: "" };

function render() {
  app.innerHTML = `
    <main class="app-shell">
        <header class="brand">
            <div class="popcorn" aria-hidden="true">🍿</div>
            <div class="brand-name">PopChoice</div>
        </header>
        <section class="content" aria-live="polite">
            ${state.view === "form" ? formTemplate() : resultTemplate()}
        </section>
    </main>`;
  if (state.view === "form")
    document
      .querySelector("#preference-form")
      .addEventListener("submit", handleSubmit);
  else
    document.querySelector("#again-button").addEventListener("click", () => {
      state.view = "form";
      state.recommendation = null;
      state.error = "";
      render();
    });
}

function formTemplate() {
  return `
    <form id="preference-form" class="preference-form">
        <label for="why">What’s your favorite movie and why?</label>
        <textarea id="why" name="why" required placeholder="The Shawshank Redemption\nBecause it taught me to never give up hope no matter how hard life gets"></textarea>

        <label for="mood">Are you in the mood for something new or a classic?</label>
        <textarea id="mood" name="mood" required placeholder="I want to watch movies that were released after 2010"></textarea>
        
        <label for="fun">Do you wanna have fun or do you want something serious?</label>
        <textarea id="fun" name="fun" required placeholder="I want to watch something stupid and fun"></textarea>
        ${
          state.error
            ? `
            <p class="error">${state.error}</p>`
            : ""
        }
        <button class="primary-button" type="submit" ${state.loading ? "disabled" : ""}>${
          state.loading
            ? '<span class="spinner"></span>Finding your pick...'
            : "Let’s Go"
        }
        </button>
    </form>`;
}

function resultTemplate() {
  const movie = state.recommendation;
  return `
    <div class="result-panel">
        <h1>
            ${movie.title} <span>(${movie.releaseYear})</span>
        </h1>
        <div class="rule"></div>
        <p class="recommendation">${movie.description}</p>
        <div class="match-note">Picked from your taste profile <span>✦</span></div>
        <button id="again-button" class="primary-button" type="button">Go Again</button>
    </div>`;
}

async function handleSubmit(event) {
  event.preventDefault();
  state.loading = true;
  state.error = "";
  render();
  try {
    state.recommendation = await getRecommendation(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    state.view = "result";
  } catch {
    state.error = "Something went wrong. Try again in a moment.";
  } finally {
    state.loading = false;
    render();
  }
}

async function getRecommendation(answers) {
  if (openai && supabase) {
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: `${answers.why}. ${answers.mood}. ${answers.fun}`,
    });
    const { data } = await supabase.rpc("match_movies", {
      query_embedding: embedding.data[0].embedding,
      match_threshold: 0.35,
      match_count: 1,
    });
    if (data?.[0])
      return {
        title: data[0].title,
        releaseYear: data[0].release_year,
        description:
          data[0].content.split(": ").slice(1).join(": ") || data[0].content,
      };
  }
  return chooseLocalMovie(answers);
}

function chooseLocalMovie(answers) {
  const text = `${answers.why} ${answers.mood} ${answers.fun}`.toLowerCase();
  const playful = /fun|stupid|comedy|laugh|light|silly/.test(text);
  const newer = /new|after|recent|202[0-9]|modern/.test(text);
  const candidates = movies.filter((movie) =>
    newer ? Number(movie.releaseYear) >= 2022 : true,
  );
  const pool = candidates.length ? candidates : movies;
  const pick = pool
    .slice()
    .sort(
      (a, b) =>
        (playful && /comedy|adventure|barbie|everything/i.test(b.content)
          ? 1
          : 0) -
          (playful && /comedy|adventure|barbie|everything/i.test(a.content)
            ? 1
            : 0) || Math.random() - 0.5,
    )[0];
  return {
    title: pick.title,
    releaseYear: pick.releaseYear,
    description: pick.content.split(": ").slice(1).join(": ") || pick.content,
  };
}

render();
