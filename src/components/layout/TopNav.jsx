import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { GiHamburgerMenu } from "react-icons/gi";
import { IoMdLogOut, IoMdClose } from "react-icons/io";
import { MdSettings, MdSwitchAccount } from "react-icons/md";
import { ImSpinner2 } from "react-icons/im";
import {
  FiSearch,
  FiCompass,
  FiFilm,
  FiTv,
  FiBookmark,
  FiCalendar,
  FiInfo,
  FiHelpCircle,
  FiUser,
  FiSettings,
  FiLogOut,
  FiArrowRight,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

import { UserAuth } from "../../context/AuthContext";
import { useProfile } from "../../context/ProfileContext";
import NotFoundPlaceholder from "../../assets/notFound-Placeholder.jpg";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
} from "../../utils/recentSearches";

const ConfirmLogoutModal = ({ open, onConfirm, onCancel }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-md flex items-center justify-center"
          onClick={onCancel}
        >
          <motion.div
            key="modal"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="
              relative w-full max-w-sm
              rounded-2xl
              bg-gradient-to-b from-[#161616] to-[#0a0a0a]
              border border-white/10
              shadow-[0_40px_120px_rgba(0,0,0,0.85)]
              overflow-hidden
            "
          >
            {/* Accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-400 to-red-600" />

            <div className="p-6">
              <h3 className="text-xl font-semibold mb-1 text-white">
                Log out?
              </h3>

              <p className="text-sm text-white/60 leading-relaxed">
                You’ll be signed out of your account and returned to the login
                screen.
              </p>

              <div className="flex justify-end gap-3 mt-8">
                {/* Cancel */}
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onCancel}
                  className="
                    px-4 py-2 text-sm rounded-lg
                    bg-white/5 text-white/80
                    hover:bg-white/10 hover:text-white
                    transition
                  "
                >
                  Cancel
                </motion.button>

                {/* Confirm */}
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onConfirm}
                  className="
                    px-4 py-2 text-sm rounded-lg
                    bg-red-500 text-white
                    hover:bg-red-400
                    shadow-[0_8px_30px_rgba(239,68,68,0.45)]
                    transition
                  "
                >
                  Log out
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const TopNav = () => {
  const { user, logOut } = UserAuth();
  const { clearSelectedProfile, selectedProfile } = useProfile();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [accountAvatar, setAccountAvatar] = useState(null);
  const dropdownRef = useRef(null);
  const accountButtonRef = useRef(null);
  const searchReqRef = useRef(0);
  const recentSearchScope = `${user?.email || "guest"}:${selectedProfile?.id || "main"}`;

  useEffect(() => {
    if (!user?.email || !selectedProfile) {
      setAccountAvatar(null);
      return;
    }
    setAccountAvatar(
      selectedProfile.avatar || selectedProfile.avatarBase64 || null,
    );
  }, [user?.email, selectedProfile]);

  useEffect(() => {
    if (!accountOpen) return;

    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        accountButtonRef.current &&
        !accountButtonRef.current.contains(e.target)
      ) {
        setAccountOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [accountOpen]);

  useEffect(() => {
    setRecentSearches(getRecentSearches(recentSearchScope));
  }, [recentSearchScope]);

  useEffect(() => {
    if (!accountOpen) return;

    const esc = (e) => e.key === "Escape" && setAccountOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [accountOpen]);

  /* ---------------- SEARCH ---------------- */

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const resetSearch = useCallback(() => {
    searchReqRef.current += 1;
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  const submitSearch = useCallback(
    (rawQuery, { closeMobile = false } = {}) => {
      const query = String(rawQuery || "").trim();
      if (!query) return false;
      setRecentSearches(addRecentSearch(query, undefined, recentSearchScope));
      resetSearch();
      setSearchFocused(false);
      if (closeMobile) setMobileOpen(false);
      navigate(`/search?q=${encodeURIComponent(query)}`);
      return true;
    },
    [navigate, recentSearchScope, resetSearch],
  );

  const openSearchPage = useCallback(() => {
    submitSearch(searchQuery);
  }, [searchQuery, submitSearch]);

  useEffect(() => {
    resetSearch();
    setSearchFocused(false);
    setRecentSearches(getRecentSearches(recentSearchScope));
  }, [location.pathname, location.search, recentSearchScope, resetSearch]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const reqId = ++searchReqRef.current;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const [moviesRes, tvRes, peopleRes] = await Promise.all([
          axios.get("https://api.themoviedb.org/3/search/movie", {
            params: { api_key: process.env.REACT_APP_TMDB_API_KEY, query },
          }),
          axios.get("https://api.themoviedb.org/3/search/tv", {
            params: { api_key: process.env.REACT_APP_TMDB_API_KEY, query },
          }),
          axios.get("https://api.themoviedb.org/3/search/person", {
            params: { api_key: process.env.REACT_APP_TMDB_API_KEY, query },
          }),
        ]);

        if (reqId !== searchReqRef.current) return;

        const movies = (moviesRes.data.results || []).map((i) => ({
          ...i,
          mediaType: "movie",
        }));
        const shows = (tvRes.data.results || []).map((i) => ({
          ...i,
          mediaType: "tv",
        }));
        const people = (peopleRes.data.results || []).map((i) => ({
          ...i,
          mediaType: "person",
        }));

        const merged = [...movies, ...shows, ...people]
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .slice(0, 12);

        setSearchResults(merged);
      } catch {
        if (reqId === searchReqRef.current) setSearchResults([]);
      } finally {
        if (reqId === searchReqRef.current) setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isPathActive = useCallback(
    (path) =>
      location.pathname === path ||
      (path !== "/" && location.pathname.startsWith(`${path}/`)),
    [location.pathname],
  );

  const mobileNavLinkClass = (path) =>
    `group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
      isPathActive(path)
        ? "border-red-400/70 bg-red-500/15 text-white shadow-[0_10px_24px_rgba(239,68,68,0.18)]"
        : "border-white/10 bg-white/[0.02] text-white/85 hover:bg-white/[0.06] hover:text-white"
    }`;

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-[1000] bg-black/80 backdrop-blur">
        <div className="h-20 px-6 lg:px-10 flex items-center justify-between">
          {/* LEFT */}
          <div className="flex items-center gap-8">
            <Link to="/" className="text-red-600 font-bold text-2xl">
              ALPHAX
            </Link>

            {/* NAV (md+) */}
            {user && (
              <nav className="hidden lg:flex items-center gap-6 text-sm text-neutral-300">
                <Link
                  to="/for-you"
                  className={`px-3 py-1 rounded-full border transition ${
                    location.pathname === "/for-you"
                      ? "border-red-500 bg-red-500 text-white shadow-[0_0_18px_rgba(239,68,68,0.3)]"
                      : "border-red-500/50 bg-transparent text-neutral-200 hover:text-white hover:border-red-500/90"
                  }`}
                >
                  For You
                </Link>
                <Link to="/movies" className="hover:text-white">
                  Movies
                </Link>
                <Link to="/shows" className="hover:text-white">
                  Series
                </Link>
                <Link to="/my-list" className="hover:text-white">
                  My List
                </Link>
                <Link to="/release-calendar" className="hover:text-white">
                  Release Calendar
                </Link>
                <Link to="/about" className="hover:text-white">
                  About
                </Link>
                <Link to="/help" className="hover:text-white">
                  Help
                </Link>
              </nav>
            )}
          </div>

          {/* CENTER SEARCH (lg+) */}
          {user && (
            <div className="relative hidden xl:flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => {
                  window.setTimeout(() => setSearchFocused(false), 120);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    openSearchPage();
                  }
                }}
                placeholder="Search movies, series, people"
                className="bg-neutral-800 text-sm text-white placeholder-neutral-400 rounded-full px-4 py-2 pr-16 w-[320px] focus:outline-none"
              />

              {searchQuery.trim() && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    resetSearch();
                    setSearchFocused(true);
                  }}
                  className="absolute right-3 text-white/70 hover:text-white transition"
                  aria-label="Clear search"
                >
                  <IoMdClose size={18} />
                </button>
              )}

              {isSearching && (
                <ImSpinner2 className="absolute right-9 text-white/70 animate-spin" />
              )}

              {searchFocused &&
                (isSearching ||
                  searchResults.length > 0 ||
                  searchQuery.trim() ||
                  recentSearches.length > 0) && (
                  <div className="absolute top-12 left-0 w-full bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="min-h-[300px] max-h-[360px] flex flex-col">
                      {isSearching ? (
                        <div className="flex-1 px-4 py-3 text-sm text-white/70 flex items-center justify-center gap-2">
                          <ImSpinner2 className="animate-spin" />
                          Searching...
                        </div>
                      ) : (
                        <motion.div
                          key={searchQuery.trim() ? "results" : "recent"}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2 }}
                          className="flex-1 overflow-y-auto py-1"
                        >
                          {searchQuery.trim() && searchResults.length === 0 && (
                            <div className="px-4 py-3 text-sm text-white/60">
                              No results found.
                            </div>
                          )}
                          {!searchQuery.trim() && recentSearches.length > 0 && (
                            <>
                              <div className="flex items-center justify-between px-3 py-2">
                                <span className="text-[11px] uppercase tracking-wide text-white/50">
                                  Recent searches
                                </span>
                                <button
                                  onClick={() => {
                                    clearRecentSearches(recentSearchScope);
                                    setRecentSearches([]);
                                  }}
                                  className="text-[11px] text-red-300 hover:text-red-200 transition"
                                >
                                  Clear
                                </button>
                              </div>
                              {recentSearches.map((term) => (
                                <button
                                  key={term}
                                  onClick={() => {
                                    submitSearch(term);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-neutral-800/90 transition"
                                >
                                  {term}
                                </button>
                              ))}
                            </>
                          )}
                          {searchResults.map((item, index) => {
                            const image =
                              item.poster_path || item.profile_path
                                ? `https://image.tmdb.org/t/p/w92${
                                    item.poster_path || item.profile_path
                                  }`
                                : null;

                            return (
                              <motion.div
                                key={`${item.mediaType}-${item.id}`}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                  duration: 0.2,
                                  delay: index * 0.025,
                                }}
                              >
                                <Link
                                  to={`/${
                                    item.mediaType === "movie"
                                      ? "movies"
                                      : item.mediaType === "tv"
                                        ? "shows"
                                        : "person"
                                  }/${item.id}`}
                                  onClick={resetSearch}
                                  className="h-12 flex items-center gap-2.5 px-3 hover:bg-neutral-800/90 transition"
                                >
                                  {image ? (
                                    <img
                                      src={image}
                                      className="w-7 h-9 object-cover rounded shrink-0"
                                      alt=""
                                    />
                                  ) : (
                                    <div className="w-7 h-9 bg-neutral-700 rounded shrink-0" />
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <span className="block text-[13px] text-white leading-tight truncate">
                                      {item.title || item.name}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {(item.release_date ||
                                        item.first_air_date) && (
                                        <span className="text-[10px] text-neutral-400">
                                          {(
                                            item.release_date ||
                                            item.first_air_date
                                          ).slice(0, 4)}
                                        </span>
                                      )}
                                      <span className="text-[10px] uppercase text-white/50 border border-white/10 px-1.5 py-0.5 rounded-full">
                                        {item.mediaType === "movie"
                                          ? "Movie"
                                          : item.mediaType === "tv"
                                            ? "Series"
                                            : "Person"}
                                      </span>
                                    </div>
                                  </div>
                                </Link>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      )}
                      {!isSearching && searchResults.length > 0 && (
                        <div className="border-t border-white/10 p-2">
                          <button
                            onClick={openSearchPage}
                            className="w-full px-3 py-2 text-center text-[12px] uppercase tracking-wide text-red-200 border border-red-400/35 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition"
                          >
                            View all results
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* RIGHT (md+) */}
          <div className="hidden lg:flex items-center gap-6 text-sm text-neutral-300 relative">
            {user ? (
              <>
                <motion.button
                  ref={accountButtonRef}
                  onClick={() => setAccountOpen((v) => !v)}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className="
                    flex items-center gap-2
                    px-4 py-2
                    rounded-full
                    bg-black/65
                    border border-white/20
                    text-sm text-white/90
                    shadow-[0_8px_24px_rgba(0,0,0,0.35)]
                    hover:text-white
                    hover:bg-black/75
                    transition
                  "
                >
                  <img
                    src={accountAvatar || NotFoundPlaceholder}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = NotFoundPlaceholder;
                    }}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover border border-white/75 bg-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_0_14px_rgba(255,255,255,0.18)]"
                  />
                  {selectedProfile?.name || "Account"}
                  <motion.span
                    animate={{ rotate: accountOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-white/50"
                  >
                    ▾
                  </motion.span>
                </motion.button>

                <AnimatePresence>
                  {accountOpen && (
                    <motion.div
                      ref={dropdownRef}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute right-0 top-10 w-44 bg-neutral-900 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50"
                    >
                      <Link
                        to="/profiles"
                        onClick={() => {
                          clearSelectedProfile();
                          setAccountOpen(false);
                        }}
                        className="
                          flex items-center gap-3
                          px-4 py-2
                          text-sm text-white/80
                          hover:text-white
                          hover:bg-neutral-800
                          transition
                        "
                      >
                        <MdSwitchAccount className="text-base text-white/60" />
                        <span>Switch Profile</span>
                      </Link>

                      <Link
                        to="/accountSettings"
                        onClick={() => setAccountOpen(false)}
                        className="
                          flex items-center gap-3
                          px-4 py-2
                          text-sm text-white/80
                          hover:text-white
                          hover:bg-neutral-800
                          transition
                        "
                      >
                        <MdSettings className="text-base text-white/60" />
                        <span>Settings</span>
                      </Link>

                      <motion.button
                        onClick={() => {
                          setAccountOpen(false);
                          setConfirmLogout(true);
                        }}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className="
                          w-full flex items-center gap-3
                          px-4 py-2
                          text-sm text-red-400
                          hover:text-red-300
                          hover:bg-red-500/10
                          transition
                        "
                      >
                        <IoMdLogOut className="text-base" />
                        <span>Log out</span>
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <Link to="/help" className="hover:text-white">
                  Help
                </Link>
                <Link to="/login" className="hover:text-white">
                  Sign In
                </Link>
              </div>
            )}
          </div>

          {/* MOBILE BUTTON */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-white"
          >
            <GiHamburgerMenu size={26} />
          </button>
        </div>
      </header>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* BACKDROP */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 z-[999]"
            />

            {/* DRAWER */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="fixed right-0 top-0 h-full w-[86vw] max-w-sm z-[1000] flex flex-col bg-gradient-to-b from-[#111214] via-[#0f1013] to-[#0a0b0d] border-l border-white/10 shadow-[-20px_0_70px_rgba(0,0,0,0.55)]"
            >
              <div className="px-5 pt-5 pb-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {user ? (
                      <>
                        <img
                          src={accountAvatar || NotFoundPlaceholder}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = NotFoundPlaceholder;
                          }}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border border-white/60"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-white/50">
                            Signed in as
                          </p>
                          <p className="text-sm text-white font-medium truncate">
                            {selectedProfile?.name || "Account"}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div>
                        <p className="text-sm text-white font-medium">Menu</p>
                        <p className="text-[11px] uppercase tracking-wide text-white/50">
                          Explore AlphaX
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="text-white/80 hover:text-white transition"
                    aria-label="Close menu"
                  >
                    <IoMdClose size={26} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {user && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        submitSearch(searchQuery, { closeMobile: true });
                      }}
                      className="relative"
                    >
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearch}
                        placeholder="Search movies, series, people"
                        className="w-full rounded-xl border border-white/10 bg-black/25 pl-9 pr-10 py-2.5 text-sm text-white placeholder-white/80 focus:outline-none focus:border-red-400/70"
                      />
                      {searchQuery.trim() && (
                        <button
                          type="button"
                          onClick={resetSearch}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition p-1"
                          aria-label="Clear search"
                        >
                          <IoMdClose size={18} />
                        </button>
                      )}
                    </form>

                    <div className="mt-3 space-y-1.5 max-h-[20vh] overflow-y-auto overscroll-contain pr-1 [touch-action:pan-y]">
                      {isSearching ? (
                        <div className="flex items-center gap-2 text-xs text-white py-1">
                          <ImSpinner2 className="animate-spin text-white" />
                          Searching...
                        </div>
                      ) : searchQuery.trim() ? (
                        searchResults.map((item) => (
                          <Link
                            key={`mobile-${item.mediaType}-${item.id}`}
                            to={`/${
                              item.mediaType === "movie"
                                ? "movies"
                                : item.mediaType === "tv"
                                  ? "shows"
                                  : "person"
                            }/${item.id}`}
                            onClick={() => {
                              resetSearch();
                              setMobileOpen(false);
                            }}
                            className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-white hover:bg-white/10 transition"
                          >
                            <span className="truncate pr-3">
                              {item.title || item.name}
                            </span>
                            <FiArrowRight className="text-white/40 shrink-0" />
                          </Link>
                        ))
                      ) : null}
                    </div>
                  </div>
                )}

                {user ? (
                  <nav className="space-y-2 text-white">
                    <Link
                      to="/for-you"
                      onClick={() => setMobileOpen(false)}
                      className={mobileNavLinkClass("/for-you")}
                    >
                      <FiCompass className="text-base text-white/70 group-hover:text-white transition" />
                      For You
                    </Link>
                    <Link
                      to="/movies"
                      onClick={() => setMobileOpen(false)}
                      className={mobileNavLinkClass("/movies")}
                    >
                      <FiFilm className="text-base text-white/65 group-hover:text-white transition" />
                      Movies
                    </Link>
                    <Link
                      to="/shows"
                      onClick={() => setMobileOpen(false)}
                      className={mobileNavLinkClass("/shows")}
                    >
                      <FiTv className="text-base text-white/65 group-hover:text-white transition" />
                      Series
                    </Link>
                    <Link
                      to="/my-list"
                      onClick={() => setMobileOpen(false)}
                      className={mobileNavLinkClass("/my-list")}
                    >
                      <FiBookmark className="text-base text-white/65 group-hover:text-white transition" />
                      My List
                    </Link>
                    <Link
                      to="/release-calendar"
                      onClick={() => setMobileOpen(false)}
                      className={mobileNavLinkClass("/release-calendar")}
                    >
                      <FiCalendar className="text-base text-white/65 group-hover:text-white transition" />
                      Release Calendar
                    </Link>
                    <Link
                      to="/about"
                      onClick={() => setMobileOpen(false)}
                      className={mobileNavLinkClass("/about")}
                    >
                      <FiInfo className="text-base text-white/65 group-hover:text-white transition" />
                      About
                    </Link>
                    <Link
                      to="/help"
                      onClick={() => setMobileOpen(false)}
                      className={mobileNavLinkClass("/help")}
                    >
                      <FiHelpCircle className="text-base text-white/65 group-hover:text-white transition" />
                      Help
                    </Link>
                    <div className="mt-4 border-t border-white/15 pt-3 text-white/60 text-[11px] uppercase tracking-[0.12em]">
                      Account
                    </div>
                    <Link
                      to="/profiles"
                      onClick={() => {
                        clearSelectedProfile();
                        setMobileOpen(false);
                      }}
                      className={mobileNavLinkClass("/profiles")}
                    >
                      <FiUser className="text-base text-white/65 group-hover:text-white transition" />
                      Switch Profile
                    </Link>
                    <Link
                      to="/accountSettings"
                      onClick={() => setMobileOpen(false)}
                      className={mobileNavLinkClass("/accountSettings")}
                    >
                      <FiSettings className="text-base text-white/65 group-hover:text-white transition" />
                      Settings
                    </Link>
                  </nav>
                ) : (
                  <nav className="space-y-2 text-white">
                    <Link
                      to="/about"
                      onClick={() => setMobileOpen(false)}
                      className={mobileNavLinkClass("/about")}
                    >
                      <FiInfo className="text-base text-white/65 group-hover:text-white transition" />
                      About
                    </Link>
                    <Link
                      to="/help"
                      onClick={() => setMobileOpen(false)}
                      className={mobileNavLinkClass("/help")}
                    >
                      <FiHelpCircle className="text-base text-white/65 group-hover:text-white transition" />
                      Help
                    </Link>
                  </nav>
                )}
              </div>

              <div className="px-5 py-4 border-t border-white/10 bg-black/20">
                {user ? (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      setConfirmLogout(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-2.5 text-red-200 hover:bg-red-500/20 transition"
                  >
                    <FiLogOut className="text-base" />
                    Logout
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block w-full text-center rounded-xl border border-white/20 bg-white/[0.04] px-4 py-2.5 text-white hover:bg-white/[0.08] transition"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmLogoutModal
        open={confirmLogout}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={async () => {
          clearSelectedProfile();
          await logOut();
          setConfirmLogout(false);
        }}
      />
    </>
  );
};

export default TopNav;
