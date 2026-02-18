import HeroRail from "../components/browse/HeroRail";
import Row from "../components/browse/ContentRow";
import requests from "../Requests";
import ContinueWatchingRow from "../components/browse/ContinueWatchingRow";
import { useSavedContent } from "../context/SavedContentContext";

const Movies = () => {
  const { savedItems } = useSavedContent();
  return (
    <div className="pt-20 pb-12 bg-black text-white">
      <HeroRail poolEndpoint={requests.movies.trending} />

      <ContinueWatchingRow mediaFilter="movie" />

      <Row
        title="Now Playing"
        fetchURL={requests.movies.nowPlaying}
        savedItems={savedItems}
      />
      <Row
        title="Popular Movies"
        fetchURL={requests.movies.popular}
        savedItems={savedItems}
      />
      <Row
        title="Top Rated Movies"
        fetchURL={requests.movies.topRated}
        savedItems={savedItems}
      />
      <Row
        title="Upcoming"
        fetchURL={requests.movies.upcoming}
        savedItems={savedItems}
      />
      <Row
        title="Trending This Week"
        fetchURL={requests.movies.trending}
        savedItems={savedItems}
      />

      <Row
        title="Action"
        fetchURL={requests.movies.genres.adventure}
        savedItems={savedItems}
      />
      <Row
        title="Comedy"
        fetchURL={requests.movies.genres.comedy}
        savedItems={savedItems}
      />
      <Row
        title="Sci-Fi"
        fetchURL={requests.movies.genres.sciFi}
        savedItems={savedItems}
      />
      <Row
        title="Horror"
        fetchURL={requests.movies.genres.horror}
        savedItems={savedItems}
      />
      <Row
        title="Mystery"
        fetchURL={requests.movies.genres.mystery}
        savedItems={savedItems}
      />
      <Row
        title="Animation"
        fetchURL={requests.movies.genres.animation}
        savedItems={savedItems}
      />
      <Row
        title="History"
        fetchURL={requests.movies.genres.history}
        savedItems={savedItems}
      />
      <Row
        title="Thriller"
        fetchURL={requests.movies.genres.thriller}
        savedItems={savedItems}
      />
      <Row
        title="Romance"
        fetchURL={requests.movies.genres.romance}
        savedItems={savedItems}
      />
      <Row
        title="War"
        fetchURL={requests.movies.genres.war}
        savedItems={savedItems}
      />
    </div>
  );
};

export default Movies;
