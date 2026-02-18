import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import DevImage from "../assets/dev.png";

const capabilities = [
  {
    title: "Discovery Engine",
    text: "Find trending movies and shows fast with genre-led browsing and curated rails.",
  },
  {
    title: "Detail-Rich Pages",
    text: "Open cinematic detail pages with cast, reviews, trailers, screenshots, and key stats.",
  },
  {
    title: "Watchlist Workflow",
    text: "Save titles, update statuses, and keep your queue clean and actionable.",
  },
  {
    title: "Series Progress",
    text: "Track episode progress, mark season milestones, and pick up exactly where you left off.",
  },
  {
    title: "Release Tracking",
    text: "Use the calendar to monitor upcoming releases from your saved library.",
  },
  {
    title: "People You Follow",
    text: "Save favourite actors and revisit their profiles and credits in one click.",
  },
];

const creatorTags = ["Frontend Developer", "UI/UX Designer", "React", "Firebase"];

const reveal = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const About = () => {
  const [isImageOpen, setIsImageOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050507] text-white pt-24 pb-14 px-4 md:px-8">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-24 -top-20 h-[420px] w-[420px] rounded-full bg-red-600/20 blur-3xl"
          animate={{ x: [0, 50, -20, 0], y: [0, -40, 15, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-24 top-10 h-[420px] w-[420px] rounded-full bg-orange-500/15 blur-3xl"
          animate={{ x: [0, -60, 25, 0], y: [0, 25, -35, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.07),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.05),transparent_35%)]"
          animate={{ opacity: [0.4, 0.55, 0.4] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6">
        <motion.section
          variants={reveal}
          initial="hidden"
          animate="show"
          transition={{ duration: 0.5 }}
          className="xl:col-span-8 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.65)]"
        >
          <p className="text-xs uppercase tracking-[0.26em] text-white/55">
            About AlphaX
          </p>
          <h1 className="mt-3 text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">
            Built for people
            <br />
            who actually track
            <br />
            what they watch.
          </h1>
          <p className="mt-5 max-w-3xl text-sm md:text-base text-white/75 leading-relaxed">
            AlphaX combines discovery, detail, and progress into one product
            flow. Browse, save, plan, and continue watching without jumping
            between apps or losing track of what comes next.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/movies"
              className="rounded-full border border-red-400/70 bg-red-500/25 px-5 py-2.5 text-sm font-semibold hover:bg-red-500 transition"
            >
              Browse Movies
            </Link>
            <Link
              to="/shows"
              className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white hover:text-black transition"
            >
              Browse Series
            </Link>
            <Link
              to="/watchlist"
              className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white hover:text-black transition"
            >
              Open Watchlist
            </Link>
          </div>
        </motion.section>

        <motion.aside
          variants={reveal}
          initial="hidden"
          animate="show"
          transition={{ duration: 0.5, delay: 0.1 }}
          className="xl:col-span-4 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-6"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-red-300/85">
            About Me
          </p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <motion.div
                className="h-14 w-14 rounded-xl overflow-hidden border border-white/20 shadow-[0_10px_28px_rgba(239,68,68,0.5)]"
                animate={{ y: [0, -4, 0], rotate: [0, -2, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                onClick={() => setIsImageOpen(true)}
              >
                <img
                  src={DevImage}
                  alt="Developer"
                  className="h-full w-full object-cover cursor-zoom-in"
                />
              </motion.div>
              <div>
                <h2 className="text-lg font-semibold">Developer & Designer</h2>
                <p className="text-xs text-white/60">Creator of AlphaX</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/75 leading-relaxed">
              Crafting a focused streaming companion centered on clarity,
              speed, and polished UI interactions.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {creatorTags.map((tag, i) => (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.2 + i * 0.06 }}
                  className="px-2.5 py-1 rounded-full text-xs border border-white/20 bg-white/10 text-white/85"
                >
                  {tag}
                </motion.span>
              ))}
            </div>
          </div>
        </motion.aside>

        <motion.section
          variants={reveal}
          initial="hidden"
          animate="show"
          transition={{ duration: 0.5, delay: 0.18 }}
          className="xl:col-span-12 rounded-3xl border border-white/10 bg-black/35 backdrop-blur p-6 md:p-8"
        >
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h3 className="text-2xl md:text-3xl font-bold tracking-tight">
              What AlphaX Provides
            </h3>
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">
              TMDB Powered Data
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {capabilities.map((item, index) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
                whileHover={{ y: -4 }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs uppercase tracking-[0.16em] text-red-300/85">
                  {item.title}
                </p>
                <p className="mt-2 text-sm text-white/75 leading-relaxed">
                  {item.text}
                </p>
              </motion.article>
            ))}
          </div>
        </motion.section>
      </div>

      <AnimatePresence>
        {isImageOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsImageOpen(false)}
            className="fixed inset-0 z-[1100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative"
            >
              <img
                src={DevImage}
                alt="Developer enlarged"
                className="max-h-[84vh] max-w-[92vw] rounded-2xl border border-white/20 shadow-[0_20px_80px_rgba(0,0,0,0.8)] object-contain"
              />
              <button
                onClick={() => setIsImageOpen(false)}
                className="absolute -top-3 -right-3 h-9 w-9 rounded-full bg-white text-black text-sm font-bold hover:scale-105 transition"
                aria-label="Close image preview"
              >
                X
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default About;
