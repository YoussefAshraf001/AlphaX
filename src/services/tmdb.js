import axios from "axios";

const API = "https://api.themoviedb.org/3";
const KEY = process.env.REACT_APP_TMDB_API_KEY;

export const discoverMoviesByActors = async (actorIds) => {
  const ids = actorIds.join(",");

  const res = await axios.get(`${API}/discover/movie`, {
    params: {
      api_key: KEY,
      with_cast: ids,
      sort_by: "popularity.desc",
    },
  });

  return res.data.results;
};
