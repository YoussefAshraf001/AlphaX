import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserAuth } from "../context/AuthContext";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

const Signup = () => {
  const { signUp } = UserAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      await signUp(username, email, password);
      toast.success("Account created 🎉");
      navigate("/");
    } catch (err) {
      toast.error(err.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      {/* BACKGROUND */}
      <div className="absolute inset-0">
        <img
          src="/Background Changes/bg.jpg"
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
              <h1 className="text-3xl font-semibold tracking-tight">
                Create account
              </h1>
              <p className="text-sm text-white/60 mt-1">
                Start tracking what you watch
              </p>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* USERNAME */}
              <div>
                <label className="block text-xs text-white/60 mb-1">
                  Username
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Your name"
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
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
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
                {loading ? "Creating account…" : "Sign Up"}
              </motion.button>
            </form>

            {/* FOOTER */}
            <div className="mt-8 text-sm text-white/60">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-white hover:text-red-400 transition"
              >
                Sign in
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;
