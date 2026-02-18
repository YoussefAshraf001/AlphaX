import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { UserAuth } from "./AuthContext";
import { auth } from "../firebase";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = UserAuth();
  const location = useLocation();
  const effectiveUser = user || auth.currentUser;

  if (loading) {
    return null;
  }

  if (!effectiveUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  } else {
    return children;
  }
};

export default ProtectedRoute;
