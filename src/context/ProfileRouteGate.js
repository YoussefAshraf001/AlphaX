import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { UserAuth } from "./AuthContext";
import { useProfile } from "./ProfileContext";
import { auth } from "../firebase";

const ProfileRouteGate = ({ children }) => {
  const { user, loading } = UserAuth();
  const { selectedProfile, profileLoading } = useProfile();
  const location = useLocation();
  const effectiveUser = user || auth.currentUser;

  if (loading || profileLoading) {
    return null;
  }

  if (!effectiveUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!selectedProfile) {
    return <Navigate to="/profiles" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default ProfileRouteGate;
