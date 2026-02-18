import HeroRail from "../components/browse/HeroRail";
import Row from "../components/browse/ContentRow";
import requests from "../Requests";
import ContinueWatchingRow from "../components/browse/ContinueWatchingRow";
import { useSavedContent } from "../context/SavedContentContext";

const Shows = () => {
  const { savedItems } = useSavedContent();
  return (
    <div className="pt-20 pb-12 bg-black text-white">
      <HeroRail poolEndpoint={requests.tv.trending} />

      <ContinueWatchingRow mediaFilter="tv" />

      <Row
        title="On The Air"
        fetchURL={requests.tv.onTheAir}
        savedItems={savedItems}
      />
      <Row
        title="Popular Series"
        fetchURL={requests.tv.popular}
        savedItems={savedItems}
      />
      <Row
        title="Top Rated Series"
        fetchURL={requests.tv.topRated}
        savedItems={savedItems}
      />
      <Row
        title="Trending This Week"
        fetchURL={requests.tv.trending}
        savedItems={savedItems}
      />

      <Row
        title="Comedy Series"
        fetchURL={requests.tv.genres.comedy}
        savedItems={savedItems}
      />
      <Row
        title="Drama Series"
        fetchURL={requests.tv.genres.drama}
        savedItems={savedItems}
      />
      <Row
        title="Action & Adventure Series"
        fetchURL={requests.tv.genres.actionAdventure}
        savedItems={savedItems}
      />
      <Row
        title="Animation Series"
        fetchURL={requests.tv.genres.animation}
        savedItems={savedItems}
      />
      <Row
        title="Crime Series"
        fetchURL={requests.tv.genres.crime}
        savedItems={savedItems}
      />
      <Row
        title="Mystery Series"
        fetchURL={requests.tv.genres.mystery}
        savedItems={savedItems}
      />
      <Row
        title="Sci-Fi & Fantasy Series"
        fetchURL={requests.tv.genres.sciFiFantasy}
        savedItems={savedItems}
      />
      <Row
        title="Documentary Series"
        fetchURL={requests.tv.genres.documentary}
        savedItems={savedItems}
      />
    </div>
  );
};

export default Shows;
