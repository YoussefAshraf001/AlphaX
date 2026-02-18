import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { GiHamburgerMenu } from "react-icons/gi";
import { IoMdLogOut, IoMdClose } from "react-icons/io";
import { MdSettings, MdSwitchAccount } from "react-icons/md";
import { ImSpinner2 } from "react-icons/im";
import { motion, AnimatePresence } from "framer-motion";

import { UserAuth } from "../../context/AuthContext";
import { useProfile } from "../../context/ProfileContext";
import NotFoundPlaceholder from "../../assets/notFound-Placeholder.jpg";

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

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [accountAvatar, setAccountAvatar] = useState(null);
  const dropdownRef = useRef(null);
  const accountButtonRef = useRef(null);
  const searchReqRef = useRef(0);

  useEffect(() => {
    if (!user?.email || !selectedProfile) {
      setAccountAvatar(null);
      return;
    }
    setAccountAvatar(selectedProfile.avatar || selectedProfile.avatarBase64 || null);
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
    if (!accountOpen) return;

    const esc = (e) => e.key === "Escape" && setAccountOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [accountOpen]);

  /* ---------------- SEARCH ---------------- */

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

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
              <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-300">
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
                <Link to="/watchlist" className="hover:text-white">
                  Watchlist
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
            <div className="relative hidden lg:flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search movies, series, people"
                className="bg-neutral-800 text-sm text-white placeholder-neutral-400 rounded-full px-4 py-2 pr-10 w-[320px] focus:outline-none"
              />

              {isSearching && (
                <ImSpinner2 className="absolute right-3 text-white/70 animate-spin" />
              )}

              {(isSearching ||
                searchResults.length > 0 ||
                searchQuery.trim()) && (
                <div className="absolute top-12 left-0 w-full bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl overflow-hidden z-50">
                  {isSearching && (
                    <div className="px-4 py-3 text-sm text-white/60 flex items-center gap-2">
                      <ImSpinner2 className="animate-spin" />
                      Searching...
                    </div>
                  )}

                  {!isSearching && searchResults.length === 0 && (
                    <div className="px-4 py-3 text-sm text-white/60">
                      No results found.
                    </div>
                  )}

                  {!isSearching && (
                    <div className="max-h-[320px] overflow-y-auto py-1">
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
                            transition={{ duration: 0.2, delay: index * 0.025 }}
                          >
                            <Link
                              to={`/${
                                item.mediaType === "movie"
                                  ? "movies"
                                  : item.mediaType === "tv"
                                    ? "shows"
                                    : "person"
                              }/${item.id}`}
                              onClick={() => {
                                setSearchQuery("");
                                setSearchResults([]);
                              }}
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
                                        item.release_date || item.first_air_date
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
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* RIGHT (md+) */}
          <div className="hidden md:flex items-center gap-6 text-sm text-neutral-300 relative">
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
                    bg-red-500/5
                    border border-red-500/40
                    text-sm text-white/80
                    hover:text-white
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
                    className="w-8 h-8 rounded-full object-cover border border-white/20"
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
            className="md:hidden text-white"
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
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed right-0 top-0 h-full w-72 bg-neutral-900 z-[1000] p-6 flex flex-col"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="self-end text-white mb-6"
              >
                <IoMdClose size={26} />
              </button>

              {user ? (
                <nav className="flex flex-col gap-4 text-white">
                  <Link
                    to="/for-you"
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2 rounded-lg border transition ${
                      location.pathname === "/for-you"
                        ? "border-red-500 bg-red-500 text-white"
                        : "border-white/30 bg-transparent text-white/85"
                    }`}
                  >
                    For You
                  </Link>
                  <Link to="/movies" onClick={() => setMobileOpen(false)}>
                    Movies
                  </Link>
                  <Link to="/shows" onClick={() => setMobileOpen(false)}>
                    Series
                  </Link>
                  <Link to="/watchlist" onClick={() => setMobileOpen(false)}>
                    Watchlist
                  </Link>
                  <Link
                    to="/release-calendar"
                    onClick={() => setMobileOpen(false)}
                  >
                    Release Calendar
                  </Link>
                  <Link to="/about" onClick={() => setMobileOpen(false)}>
                    About
                  </Link>
                  <Link to="/help" onClick={() => setMobileOpen(false)}>
                    Help
                  </Link>
                  <div className="mt-2 border-t border-white/15 pt-3 text-white/70 text-xs uppercase tracking-wide">
                    Account
                  </div>
                  <Link
                    to="/profiles"
                    onClick={() => {
                      clearSelectedProfile();
                      setMobileOpen(false);
                    }}
                  >
                    Switch Profile
                  </Link>
                  <Link to="/accountSettings" onClick={() => setMobileOpen(false)}>
                    Settings
                  </Link>
                </nav>
              ) : (
                <nav className="flex flex-col gap-4 text-white">
                  <Link to="/about" onClick={() => setMobileOpen(false)}>
                    About
                  </Link>
                  <Link to="/help" onClick={() => setMobileOpen(false)}>
                    Help
                  </Link>
                </nav>
              )}

              <div className="mt-auto">
                {user ? (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      setConfirmLogout(true);
                    }}
                    className="mt-6 text-white"
                  >
                    Logout
                  </button>
                ) : (
                  <Link to="/login" onClick={() => setMobileOpen(false)}>
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
