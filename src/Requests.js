const API_KEY = process.env.REACT_APP_TMDB_API_KEY;
const BASE = "https://api.themoviedb.org/3";

const requests = {
  /* ===================== MOVIES ===================== */

  movies: {
    nowPlaying: `${BASE}/movie/now_playing?api_key=${API_KEY}&language=en-US&page=1`,
    popular: `${BASE}/movie/popular?api_key=${API_KEY}&language=en-US&page=1`,
    topRated: `${BASE}/movie/top_rated?api_key=${API_KEY}&language=en-US&page=1`,
    upcoming: `${BASE}/movie/upcoming?api_key=${API_KEY}&language=en-US&page=1`,

    trending: `${BASE}/trending/movie/week?api_key=${API_KEY}`,

    genres: {
      horror: `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=27`,
      mystery: `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=9648`,
      animation: `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=16`,
      adventure: `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=12`,
      comedy: `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=35`,
      history: `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=36`,
      sciFi: `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=878`,
      thriller: `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=53`,
      romance: `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=10749`,
      war: `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=10752`,
    },
  },

  /* ===================== TV SHOWS ===================== */

  tv: {
    onTheAir: `${BASE}/tv/on_the_air?api_key=${API_KEY}&language=en-US&page=1`,
    popular: `${BASE}/tv/popular?api_key=${API_KEY}&language=en-US&page=1`,
    topRated: `${BASE}/tv/top_rated?api_key=${API_KEY}&language=en-US&page=1`,

    trending: `${BASE}/trending/tv/week?api_key=${API_KEY}`,

    genres: {
      comedy: `${BASE}/discover/tv?api_key=${API_KEY}&with_genres=35`,
      drama: `${BASE}/discover/tv?api_key=${API_KEY}&with_genres=18`,
      actionAdventure: `${BASE}/discover/tv?api_key=${API_KEY}&with_genres=10759`,
      animation: `${BASE}/discover/tv?api_key=${API_KEY}&with_genres=16`,
      crime: `${BASE}/discover/tv?api_key=${API_KEY}&with_genres=80`,
      mystery: `${BASE}/discover/tv?api_key=${API_KEY}&with_genres=9648`,
      sciFiFantasy: `${BASE}/discover/tv?api_key=${API_KEY}&with_genres=10765`,
      documentary: `${BASE}/discover/tv?api_key=${API_KEY}&with_genres=99`,
    },
  },

  /* ===================== PEOPLE ===================== */

  people: {
    popular: `${BASE}/person/popular?api_key=${API_KEY}&language=en-US&page=1`,
  },
};

export default requests;
