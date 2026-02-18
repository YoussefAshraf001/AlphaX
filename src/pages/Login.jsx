import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { UserAuth } from "../context/AuthContext";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import {
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { auth } from "../firebase";

const Login = () => {
  const { logIn } = UserAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence,
      );

      await logIn(email, password);
      const fromPath = location.state?.from;
      navigate(fromPath || "/profiles", { replace: true });
      toast.success("Welcome back 👋");
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      {/* BACKGROUND */}
      <div className="absolute inset-0">
        <img
          src="/SignIn-bg.jpg"
          alt=""
          className="w-full h-full object-cover scale-110 blur-sm"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 18 }}
          className="
            w-full max-w-md
            rounded-2xl
            bg-white/5 backdrop-blur-xl
            border border-white/10
            shadow-[0_40px_120px_rgba(0,0,0,0.85)]
          "
        >
          <div className="p-8">
            {/* HEADER */}
            <div className="mb-6">
              <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
              <p className="text-sm text-white/60 mt-1">
                Continue where you left off
              </p>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* EMAIL */}
              <div>
                <label className="block text-xs text-white/60 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="
                    w-full rounded-lg
                    bg-black/40
                    border border-white/10
                    px-4 py-3 text-sm
                    placeholder-white/30
                    focus:border-red-500 focus:ring-2 focus:ring-red-500/30
                    outline-none transition
                  "
                />
              </div>

              {/* PASSWORD */}
              <div>
                <label className="block text-xs text-white/60 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="
                      w-full rounded-lg
                      bg-black/40
                      border border-white/10
                      px-4 py-3 text-sm
                      placeholder-white/30
                      focus:border-red-500 focus:ring-2 focus:ring-red-500/30
                      outline-none transition
                    "
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition"
                  >
                    {showPassword ? <FaRegEyeSlash /> : <FaRegEye />}
                  </button>
                </div>
              </div>

              {/* OPTIONS */}
              <div className="flex items-center justify-between text-xs text-white/60">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="accent-red-500"
                  />
                  Remember me
                </label>

                <Link to="/help" className="hover:text-white transition">
                  Need help?
                </Link>
              </div>

              {/* SUBMIT */}
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                disabled={loading}
                className="
                  w-full mt-4
                  rounded-lg
                  bg-red-600
                  py-3 text-sm font-medium
                  hover:bg-red-500
                  disabled:opacity-60
                  transition
                  shadow-[0_10px_30px_rgba(239,68,68,0.4)]
                "
              >
                {loading ? "Signing in…" : "Sign In"}
              </motion.button>
            </form>

            {/* FOOTER */}
            <div className="mt-8 text-sm text-white/60">
              New here?{" "}
              <Link
                to="/signup"
                className="text-white hover:text-red-400 transition"
              >
                Create an account
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;

