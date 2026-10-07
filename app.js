/*
  API documentation used:
  TheMealDB (2026), Free Recipe API: https://www.themealdb.com/api.php
  Open-Meteo (2026), Weather Forecast API: https://open-meteo.com/en/docs
  Open-Meteo (2026), Geocoding API: https://open-meteo.com/en/docs/geocoding-api
*/

"use strict";

const MEAL_API = "https://www.themealdb.com/api/json/v1/1";
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const STORAGE_KEYS = { favourites: "mealmate-favourites", search: "mealmate-search", theme: "mealmate-theme" };

const elements = {
  form: document.querySelector("#meal-form"),
  searchButton: document.querySelector("#search-button"),
  resetButton: document.querySelector("#reset-button"),
  category: document.querySelector("#category"),
  area: document.querySelector("#area"),
  notes: document.querySelector("#notes"),
  notesCount: document.querySelector("#notes-count"),
  status: document.querySelector("#api-status"),
  summary: document.querySelector("#results-summary"),
  results: document.querySelector("#meal-results"),
  weather: document.querySelector("#weather-guidance"),
  favourites: document.querySelector("#favourite-results"),
  favouritesEmpty: document.querySelector("#favourites-empty"),
  favouriteCount: document.querySelector("#favourite-count"),
  menuButton: document.querySelector(".menu-button"),
  navigation: document.querySelector("#primary-navigation"),
  themeButton: document.querySelector("#theme-button")
};

let favouriteMeals = readJSON(STORAGE_KEYS.favourites, []);

document.addEventListener("DOMContentLoaded", initialise);

async function initialise() {
  restoreTheme();
  restoreSearch();
  renderFavourites();
  attachEvents();
  await populateFilters();
}

function attachEvents() {
  elements.form.addEventListener("submit", handleSearch);
  elements.form.addEventListener("reset", handleReset);
  elements.notes.addEventListener("input", () => { elements.notesCount.textContent = elements.notes.value.length; });
  elements.results.addEventListener("click", handleFavouriteClick);
  elements.favourites.addEventListener("click", handleFavouriteClick);
  elements.menuButton.addEventListener("click", toggleMenu);
  elements.navigation.addEventListener("click", event => { if (event.target.matches("a")) closeMenu(); });
  elements.themeButton.addEventListener("click", toggleTheme);
}

async function populateFilters() {
  try {
    const [categoryData, areaData] = await Promise.all([
      fetchJSON(`${MEAL_API}/list.php?c=list`),
      fetchJSON(`${MEAL_API}/list.php?a=list`)
    ]);
    fillSelect(elements.category, categoryData.meals, "strCategory");
    fillSelect(elements.area, areaData.meals, "strArea");
    restoreSelectValues();
  } catch (error) {
    setStatus("Recipe filters could not be loaded, but ingredient search is still available.", "error");
  }
}

function fillSelect(select, items, property) {
  const fragment = document.createDocumentFragment();
  (items || []).forEach(item => {
    const option = document.createElement("option");
    option.value = item[property];
    option.textContent = item[property];
    fragment.append(option);
  });
  select.append(fragment);
}

async function handleSearch(event) {
  event.preventDefault();
  clearValidation();
  if (!validateForm()) return;

  const formData = new FormData(elements.form);
  const query = {
    name: formData.get("userName").trim(),
    ingredient: formData.get("ingredient").trim(),
    category: formData.get("category"),
    area: formData.get("area"),
    city: formData.get("city").trim(),
    servings: formData.get("servings"),
    experience: formData.get("experience"),
    simple: formData.get("quickOnly") === "yes",
    notes: formData.get("notes").trim()
  };

  if (formData.get("saveSearch") === "yes") localStorage.setItem(STORAGE_KEYS.search, JSON.stringify(query));
  else localStorage.removeItem(STORAGE_KEYS.search);

  setLoading(true);
  setStatus(`Searching recipes with ${query.ingredient}…`);
  elements.results.replaceChildren();
  elements.weather.hidden = true;

  try {
    const filterRequests = [
      fetchJSON(`${MEAL_API}/filter.php?i=${encodeURIComponent(normaliseIngredient(query.ingredient))}`),
      query.category ? fetchJSON(`${MEAL_API}/filter.php?c=${encodeURIComponent(query.category)}`) : Promise.resolve(null),
      query.area ? fetchJSON(`${MEAL_API}/filter.php?a=${encodeURIComponent(query.area)}`) : Promise.resolve(null)
    ];
    const [ingredientData, categoryData, areaData] = await Promise.all(filterRequests);
    if (!ingredientData.meals) throw new Error("NO_RESULTS");

    const allowedCategoryIds = categoryData ? new Set((categoryData.meals || []).map(meal => meal.idMeal)) : null;
    const allowedAreaIds = areaData ? new Set((areaData.meals || []).map(meal => meal.idMeal)) : null;
    const shortlist = ingredientData.meals
      .filter(meal => !allowedCategoryIds || allowedCategoryIds.has(meal.idMeal))
      .filter(meal => !allowedAreaIds || allowedAreaIds.has(meal.idMeal))
      .slice(0, 6);
    if (!shortlist.length) throw new Error("NO_MATCHING_FILTERS");

    const detailedMeals = await Promise.all(shortlist.map(meal => fetchJSON(`${MEAL_API}/lookup.php?i=${encodeURIComponent(meal.idMeal)}`)));
    const meals = detailedMeals
      .map(item => item.meals?.[0])
      .filter(Boolean)
      .slice(0, 6);

    if (!meals.length) throw new Error("NO_MATCHING_FILTERS");
    renderMeals(meals, query);
    elements.summary.textContent = `${meals.length} recommendation${meals.length === 1 ? "" : "s"} for ${query.name}.`;
    setStatus("Recipes loaded successfully.", "success");

    if (query.city) await showWeatherGuidance(query.city);
    document.querySelector("#results").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    const message = error.message === "NO_MATCHING_FILTERS"
      ? "Meals were found for that ingredient, but none matched both filters. Try choosing any category or cuisine."
      : error.message === "NO_RESULTS"
        ? "No meals were found. Check the ingredient spelling or try a simpler ingredient such as chicken, rice or potato."
        : "The recipe service could not be reached. Check your connection and try again.";
    setStatus(message, "error");
    elements.summary.textContent = "No recommendations to display.";
  } finally {
    setLoading(false);
  }
}

function validateForm() {
  let valid = true;
  const name = document.querySelector("#user-name");
  const ingredient = document.querySelector("#ingredient");
  const experience = document.querySelector('input[name="experience"]:checked');

  if (name.value.trim().length < 2) { showFieldError(name, "name-error", "Enter at least two characters for your name."); valid = false; }
  if (ingredient.value.trim().length < 2) { showFieldError(ingredient, "ingredient-error", "Enter a main ingredient."); valid = false; }
  if (!experience) {
    document.querySelector("#experience-error").textContent = "Choose your cooking confidence.";
    document.querySelector('input[name="experience"]').focus();
    valid = false;
  }
  if (!valid && name.getAttribute("aria-invalid") === "true") name.focus();
  return valid;
}

function showFieldError(field, errorId, message) {
  field.setAttribute("aria-invalid", "true");
  document.querySelector(`#${errorId}`).textContent = message;
}

function clearValidation() {
  elements.form.querySelectorAll("[aria-invalid]").forEach(field => field.removeAttribute("aria-invalid"));
  elements.form.querySelectorAll(".field-error").forEach(error => { error.textContent = ""; });
}

function renderMeals(meals, query) {
  const fragment = document.createDocumentFragment();
  meals.forEach(meal => fragment.append(createMealCard(meal, query, false)));
  elements.results.replaceChildren(fragment);
}

function createMealCard(meal, query = {}, compact = false) {
  const article = makeElement("article", "meal-card");
  const image = document.createElement("img");
  image.src = meal.strMealThumb;
  image.alt = `${meal.strMeal} served on a plate`;
  image.loading = "lazy";
  image.width = 640;
  image.height = 400;

  const content = makeElement("div", "meal-card-content");
  content.append(makeElement("p", "meal-meta", `${meal.strArea || "International"} · ${meal.strCategory || "Meal"}`));
  content.append(makeElement("h3", "", meal.strMeal));

  if (!compact) {
    const suitability = query.experience === "beginner" ? "Take your time and read every step before cooking." : "Review the method and prepare the ingredients before starting.";
    content.append(makeElement("p", "", `${query.servings || 2} serving plan. ${suitability}`));
    if (query.notes) content.append(makeElement("p", "", `Your reminder: ${query.notes}`));

    const details = makeElement("details", "instruction-details");
    details.append(makeElement("summary", "", "Ingredients and method"));
    const list = makeElement("ul", "ingredient-list");
    getIngredients(meal).forEach(item => list.append(makeElement("li", "", item)));
    details.append(list);
    const instructions = query.simple ? shortenInstructions(meal.strInstructions) : meal.strInstructions;
    details.append(makeElement("p", "", instructions || "Detailed instructions are not available."));
    content.append(details);
  }

  const actions = makeElement("div", "meal-actions");
  const favourite = makeElement("button", "button button-secondary favourite-button", isFavourite(meal.idMeal) ? "Saved" : "Save favourite");
  favourite.type = "button";
  favourite.dataset.mealId = meal.idMeal;
  favourite.setAttribute("aria-pressed", String(isFavourite(meal.idMeal)));
  favourite._mealData = meal;
  actions.append(favourite);

  const source = safeURL(meal.strSource || meal.strYoutube);
  if (source) {
    const link = makeElement("a", "button button-primary", "Open recipe source");
    link.href = source;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    actions.append(link);
  }

  content.append(actions);
  article.append(image, content);
  return article;
}

function getIngredients(meal) {
  const ingredients = [];
  for (let index = 1; index <= 20; index += 1) {
    const ingredient = meal[`strIngredient${index}`]?.trim();
    const measure = meal[`strMeasure${index}`]?.trim();
    if (ingredient) ingredients.push(`${measure ? `${measure} ` : ""}${ingredient}`);
  }
  return ingredients;
}

function shortenInstructions(text = "") {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, 5).join(" ") + (sentences.length > 5 ? "…" : "");
}

async function showWeatherGuidance(city) {
  try {
    const locationData = await fetchJSON(`${GEOCODING_API}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const location = locationData.results?.[0];
    if (!location) throw new Error("CITY_NOT_FOUND");
    const weatherData = await fetchJSON(`${WEATHER_API}?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code&timezone=auto`);
    const temperature = weatherData.current?.temperature_2m;
    if (typeof temperature !== "number") throw new Error("WEATHER_UNAVAILABLE");
    const advice = temperature <= 10 ? "A warming soup, stew or baked dish may suit the weather." : temperature >= 24 ? "A lighter meal or salad may feel more comfortable in the warm weather." : "The mild weather suits a wide range of meals.";
    elements.weather.textContent = `Current temperature near ${location.name}: ${Math.round(temperature)}°C. ${advice}`;
    elements.weather.hidden = false;
  } catch (error) {
    elements.weather.textContent = "Weather guidance is unavailable, but your recipe results are ready.";
    elements.weather.hidden = false;
  }
}

function handleFavouriteClick(event) {
  const button = event.target.closest(".favourite-button");
  if (!button) return;
  const id = button.dataset.mealId;
  if (isFavourite(id)) favouriteMeals = favouriteMeals.filter(meal => meal.idMeal !== id);
  else if (button._mealData) favouriteMeals.push(button._mealData);
  localStorage.setItem(STORAGE_KEYS.favourites, JSON.stringify(favouriteMeals));
  updateFavouriteButtons();
  renderFavourites();
}

function renderFavourites() {
  const fragment = document.createDocumentFragment();
  favouriteMeals.forEach(meal => fragment.append(createMealCard(meal, {}, true)));
  elements.favourites.replaceChildren(fragment);
  elements.favouritesEmpty.hidden = favouriteMeals.length > 0;
  elements.favouriteCount.textContent = favouriteMeals.length;
}

function updateFavouriteButtons() {
  document.querySelectorAll(".favourite-button").forEach(button => {
    const saved = isFavourite(button.dataset.mealId);
    button.textContent = saved ? "Saved" : "Save favourite";
    button.setAttribute("aria-pressed", String(saved));
  });
}

function isFavourite(id) { return favouriteMeals.some(meal => meal.idMeal === id); }

function handleReset() {
  window.setTimeout(() => {
    clearValidation();
    elements.notesCount.textContent = "0";
    elements.results.replaceChildren();
    elements.summary.textContent = "Complete the planner to begin.";
    elements.weather.hidden = true;
    setStatus("");
    localStorage.removeItem(STORAGE_KEYS.search);
  }, 0);
}

function restoreSearch() {
  const saved = readJSON(STORAGE_KEYS.search, null);
  if (!saved) return;
  document.querySelector("#user-name").value = saved.name || "";
  document.querySelector("#ingredient").value = saved.ingredient || "";
  document.querySelector("#city").value = saved.city || "";
  document.querySelector("#servings").value = saved.servings || 2;
  document.querySelector("#notes").value = saved.notes || "";
  elements.notesCount.textContent = (saved.notes || "").length;
  const experience = document.querySelector(`input[name="experience"][value="${saved.experience}"]`);
  if (experience) experience.checked = true;
  document.querySelector('input[name="quickOnly"]').checked = Boolean(saved.simple);
  document.querySelector('input[name="saveSearch"]').checked = true;
  elements.form.dataset.savedCategory = saved.category || "";
  elements.form.dataset.savedArea = saved.area || "";
}

function restoreSelectValues() {
  elements.category.value = elements.form.dataset.savedCategory || "";
  elements.area.value = elements.form.dataset.savedArea || "";
}

function toggleMenu() {
  const open = elements.navigation.dataset.open !== "true";
  elements.navigation.dataset.open = String(open);
  elements.menuButton.setAttribute("aria-expanded", String(open));
  elements.menuButton.querySelector(".sr-only").textContent = open ? "Close navigation" : "Open navigation";
}

function closeMenu() {
  elements.navigation.dataset.open = "false";
  elements.menuButton.setAttribute("aria-expanded", "false");
  elements.menuButton.querySelector(".sr-only").textContent = "Open navigation";
}

function toggleTheme() {
  const dark = document.body.dataset.theme !== "dark";
  applyTheme(dark ? "dark" : "light");
}

function restoreTheme() { applyTheme(localStorage.getItem(STORAGE_KEYS.theme) || "light"); }

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const dark = theme === "dark";
  elements.themeButton.textContent = dark ? "Light mode" : "Dark mode";
  elements.themeButton.setAttribute("aria-pressed", String(dark));
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.json();
}

function setLoading(loading) {
  elements.searchButton.disabled = loading;
  elements.searchButton.textContent = loading ? "Searching…" : "Search recipes";
  elements.form.setAttribute("aria-busy", String(loading));
}

function setStatus(message, state = "") {
  elements.status.textContent = message;
  if (state) elements.status.dataset.state = state;
  else delete elements.status.dataset.state;
}

function makeElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function normaliseIngredient(value) { return value.trim().toLowerCase().replace(/\s+/g, "_"); }

function safeURL(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
