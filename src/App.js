import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "react-hot-toast";

import ProtectedRoute from "./context/ProtectedRoute";
import { AuthContextProvider } from "./context/AuthContext";
import { ProfileContextProvider } from "./context/ProfileContext";
import ProfileRouteGate from "./context/ProfileRouteGate";
import { SavedContentProvider } from "./context/SavedContentContext.js";
import TopNav from "./components/layout/TopNav.jsx";
import Home from "./pages/Home";
import Login from "./pages/Login.jsx";
import SignUp from "./pages/SignUp.jsx";
import AccountSettings from "./pages/AccountSettings.jsx";
import Watchlist from "./pages/Watchlist.jsx";
import MovieDetails from "./pages/MovieDetails.jsx";
import ShowDetails from "./pages/ShowDetails.jsx";
import ActorDetails from "./pages/ActorDetails.jsx";
import HelpPage from "./pages/HelpPage.jsx";
import Movies from "./pages/Movies.jsx";
import Shows from "./pages/Shows.jsx";
import ReleaseCalendar from "./pages/ReleaseCalendar.jsx";
import About from "./pages/About.jsx";
import ForYou from "./pages/ForYou.jsx";
import WhoIsWatching from "./pages/WhoIsWatching.jsx";

const RouteShell = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.22, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);

function App() {
  const location = useLocation();
  const normalizedPath = location.pathname.toLowerCase();
  const hideTopNav =
    normalizedPath === "/profiles" ||
    normalizedPath === "/login" ||
    normalizedPath === "/signup";

  return (
    <>
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 3000,
          style: {
            background: "rgba(13, 13, 13, 0.96)",
            color: "#ffffff",
            border: "1px solid rgba(229, 9, 20, 0.85)",
            boxShadow: "0 10px 28px rgba(0, 0, 0, 0.6)",
          },
          success: {
            iconTheme: {
              primary: "#E50914",
              secondary: "#0D0D0D",
            },
          },
          error: {
            iconTheme: {
              primary: "#E50914",
              secondary: "#0D0D0D",
            },
          },
        }}
      />
      <AuthContextProvider>
        <ProfileContextProvider>
          <SavedContentProvider>
            {!hideTopNav && <TopNav />}
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route
                  path="/profiles"
                  element={
                    <ProtectedRoute>
                      <RouteShell>
                        <WhoIsWatching />
                      </RouteShell>
                    </ProtectedRoute>
                  }
                />
              <Route
                path="/"
                element={
                    <ProfileRouteGate>
                      <RouteShell>
                        <Home />
                      </RouteShell>
                    </ProfileRouteGate>
                }
              />
              <Route
                path="/for-you"
                element={
                    <ProfileRouteGate>
                      <RouteShell>
                        <ForYou />
                      </RouteShell>
                    </ProfileRouteGate>
                }
              />
              <Route
                path="/login"
                element={
                  <RouteShell>
                    <Login />
                  </RouteShell>
                }
              />
              <Route
                path="/signup"
                element={
                  <RouteShell>
                    <SignUp />
                  </RouteShell>
                }
              />
              <Route
                path="/help"
                element={
                  <RouteShell>
                    <HelpPage />
                  </RouteShell>
                }
              />
              <Route
                path="/movies"
                element={
                    <ProfileRouteGate>
                      <RouteShell>
                        <Movies />
                      </RouteShell>
                    </ProfileRouteGate>
                }
              />
              <Route
                path="/movies/:id"
                element={
                    <ProfileRouteGate>
                      <RouteShell>
                        <MovieDetails />
                      </RouteShell>
                    </ProfileRouteGate>
                }
              />
              <Route
                path="/shows"
                element={
                    <ProfileRouteGate>
                      <RouteShell>
                        <Shows />
                      </RouteShell>
                    </ProfileRouteGate>
                }
              />
              <Route
                path="/about"
                element={
                  <ProfileRouteGate>
                    <RouteShell>
                      <About />
                    </RouteShell>
                  </ProfileRouteGate>
                }
              />
              <Route
                path="/release-calendar"
                element={
                    <ProfileRouteGate>
                      <RouteShell>
                        <ReleaseCalendar />
                      </RouteShell>
                    </ProfileRouteGate>
                }
              />
              <Route
                path="/shows/:id"
                element={
                    <ProfileRouteGate>
                      <RouteShell>
                        <ShowDetails />
                      </RouteShell>
                    </ProfileRouteGate>
                }
              />
              <Route
                path="/person/:actorId"
                element={
                    <ProfileRouteGate>
                      <RouteShell>
                        <ActorDetails />
                      </RouteShell>
                    </ProfileRouteGate>
                }
              />
              <Route
                path="/watchlist"
                element={
                    <ProfileRouteGate>
                      <ProtectedRoute>
                        <RouteShell>
                          <Watchlist />
                        </RouteShell>
                      </ProtectedRoute>
                    </ProfileRouteGate>
                }
              />
              <Route
                path="/accountSettings"
                element={
                    <ProfileRouteGate>
                      <ProtectedRoute>
                        <RouteShell>
                          <AccountSettings />
                        </RouteShell>
                      </ProtectedRoute>
                    </ProfileRouteGate>
                }
              />
              </Routes>
            </AnimatePresence>
          </SavedContentProvider>
        </ProfileContextProvider>
      </AuthContextProvider>
    </>
  );
}

export default App;
