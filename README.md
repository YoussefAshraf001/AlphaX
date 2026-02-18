# AlphaX

AlphaX is a Netflix-style streaming tracker + IMDB-style discovery app built with React, Firebase, TMDB, and Framer Motion.

This repository is a **clone/evolution of my original Netflix Clone project**, expanded with profile-based personalization, ratings, actor workflows, and richer watchlist tools.

## What It Does

- Browse movies and shows from TMDB
- Open detailed pages for movies, shows, and actors
- Manage multiple profiles under one account (`Who's Watching?`)
- Save content, track watch status, mark favourites, and rate titles
- Rate actors with emoji reactions
- Use a personalized `For You` experience
- Customize favourite actor images (upload file or URL link) from watchlist

## Core Features

- Authentication + Firestore persistence (Firebase)
- Profile-scoped data isolation:
  - saved content
  - ratings
  - favourite actors
- Watchlist enhancements:
  - movies/shows/actors tabs
  - actor sections (`Favourite Actors`, `Rated Actors`)
  - per-item metadata refresh on posters
  - consistent card actions and animated UI states
- Global Netflix-themed toasts (black/red style)
- Route guards for auth/profile selection
- Motion-rich transitions across pages and modals

## Tech Stack

- React 18
- React Router v6
- Firebase Auth + Firestore
- Tailwind CSS
- Framer Motion
- React Hot Toast
- Axios
- TMDB API

## Project Structure

```txt
src/
  components/
  context/
  pages/
  utils/
  firebase.js
  App.js
```

## Routes

- `/` Home
- `/for-you`
- `/movies`
- `/movies/:id`
- `/shows`
- `/shows/:id`
- `/person/:actorId`
- `/watchlist`
- `/about`
- `/help`
- `/release-calendar`
- `/accountSettings`
- `/profiles`
- `/login`
- `/signup`

## Environment Variables

Create a `.env` file in project root:

```bash
REACT_APP_TMDB_API_KEY=...

REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_MESSAGING_SENDER=...
REACT_APP_APP_ID=...
```

## Run Locally

```bash
npm install
npm start
```

Build for production:

```bash
npm run build
```

## Notes

- Data is profile-aware; each selected profile keeps separate watchlist, favourites, and ratings.
- TMDB posters/backdrops can be refreshed from watchlist card actions if upstream assets change.

## Credits

- TMDB for media metadata and images
- Firebase for auth/database infrastructure

