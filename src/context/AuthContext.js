import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";

const AuthContext = createContext();

const mapErrorToMessage = (errorCode) => {
  // console.log("Firebase Error Code:", errorCode);
  switch (errorCode) {
    case "auth/email-already-in-use":
      return "The email address is already in use. Please try logging in or use a different email.";
    case "auth/invalid-login-credentials":
      return "Invalid email or password. Please try again, or sign up if you haven't yet.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password should be at least 6 characters long.";
    case "auth/user-not-found":
      return "No user found with this email. Please sign up first.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection and try again.";
    default:
      return "An unknown error occurred. Please try again later.";
  }
};

export function AuthContextProvider({ children }) {
  const [user, setUser] = useState(null); // Initial state can be null
  const [loading, setLoading] = useState(true); // Track loading state
  const [error, setError] = useState(null); // Track error state

  const signUp = async (username, email, password) => {
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", email), {
        username,
        savedContent: [],
      });

      await signInWithEmailAndPassword(auth, email, password);
      setError("");
    } catch (err) {
      const errorMessage = mapErrorToMessage(err.code);
      setError(errorMessage);
      throw new Error(errorMessage); // <-- IMPORTANT
    } finally {
      setLoading(false);
    }
  };

  const logIn = async (email, password) => {
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      setUser(credential.user);
      setError("");
      return credential.user;
    } catch (err) {
      const errorMessage = mapErrorToMessage(err.code);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (err) {
      const errorMessage = mapErrorToMessage(err.code);
      setError(errorMessage);
      throw new Error(errorMessage); // <-- keep it consistent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Set loading to false when user state is determined
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ signUp, logIn, logOut, user, loading, error }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function UserAuth() {
  return useContext(AuthContext);
}
