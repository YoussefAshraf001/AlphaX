import HeroRail from "../components/browse/HeroRail";
import ContentRow from "../components/browse/ContentRow";
import requests from "../Requests";
import ContinueWatchingRow from "../components/browse/ContinueWatchingRow";
import { useSavedContent } from "../context/SavedContentContext";

const Home = () => {
  const { savedItems } = useSavedContent();
  return (
    <div className="pt-20 bg-[#0b0b0b] min-h-screen text-white pb-32">
      <HeroRail poolEndpoint={requests.movies.trending} />

      <ContinueWatchingRow mediaFilter="all" />

      <div className="px-10 space-y-8">
        <ContentRow
          title="Now Playing Movies"
          fetchURL={requests.movies.nowPlaying}
          savedItems={savedItems}
        />

        <ContentRow
          title="Popular Movies"
          fetchURL={requests.movies.popular}
          savedItems={savedItems}
        />

        <ContentRow
          title="Top Rated Movies"
          fetchURL={requests.movies.topRated}
          savedItems={savedItems}
        />

        <ContentRow
          title="Upcoming Movies"
          fetchURL={requests.movies.upcoming}
          savedItems={savedItems}
        />

        <ContentRow
          title="Sci-Fi Movies"
          fetchURL={requests.movies.genres.sciFi}
          savedItems={savedItems}
        />

        <ContentRow
          title="Comedy Movies"
          fetchURL={requests.movies.genres.comedy}
          savedItems={savedItems}
        />

        <ContentRow
          title="On The Air"
          fetchURL={requests.tv.onTheAir}
          savedItems={savedItems}
        />

        <ContentRow
          title="Popular TV Shows"
          fetchURL={requests.tv.popular}
          savedItems={savedItems}
        />

        <ContentRow
          title="Top Rated TV Shows"
          fetchURL={requests.tv.topRated}
          savedItems={savedItems}
        />

        <ContentRow
          title="Comedy Series"
          fetchURL={requests.tv.genres.comedy}
          savedItems={savedItems}
        />

        <ContentRow
          title="Drama Series"
          fetchURL={requests.tv.genres.drama}
          savedItems={savedItems}
        />
      </div>
    </div>
  );
};

export default Home;
