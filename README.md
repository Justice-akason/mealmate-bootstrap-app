# MealMate Recipe Finder

MealMate is a responsive web application that helps users find recipes using an ingredient, meal category and cuisine preference. An optional city field adds weather-based meal guidance.

## Features

- Semantic HTML structure and accessible navigation
- Mobile-first custom CSS with no design template
- Validated form using text, search, number, select, radio, checkbox and textarea controls
- Form-driven recipe search using TheMealDB
- Categories and cuisines loaded from TheMealDB
- Detailed recipe lookup using a separate endpoint
- Optional weather guidance using Open-Meteo geocoding and forecast endpoints
- Loading, success, empty-result and error messages
- Saved favourites and remembered searches using localStorage
- Light and dark themes
- Keyboard focus indicators, skip link and live status regions

## Project structure

```text
index.html
css/styles.css
js/app.js
README.md
REFERENCES.md
TESTING.md
```

## Run locally

Open the folder in Visual Studio Code and use Live Server on `index.html`. The API features require an internet connection.

## Published application

https://justice-akason.github.io/mealmate-bootstrap-app/

## Important note

MealMate provides recipe suggestions only. Users must independently check ingredients, allergens, dietary suitability and cooking safety.
