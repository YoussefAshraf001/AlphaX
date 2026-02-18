import React, { useState, useEffect } from "react";
import { FaHeart } from "react-icons/fa";
import { Link } from "react-router-dom";

const LikedActors = ({ likedActors, unlikeActor }) => {
  const [visibleActors, setVisibleActors] = useState(likedActors);
  const [selectedActor, setSelectedActor] = useState(null);
  const [actorDetails, setActorDetails] = useState(null);
  const [removingActorId, setRemovingActorId] = useState(null);

  useEffect(() => {
    setVisibleActors(likedActors);
  }, [likedActors]);

  const fetchActorDetails = async (actorId) => {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/person/${actorId}?api_key=${process.env.REACT_APP_TMDB_API_KEY}`
      );
      const data = await response.json();
      setActorDetails(data);
      setSelectedActor(actorId);
    } catch (error) {
      console.error("Error fetching actor details:", error);
    }
  };

  const closeDetails = () => {
    setSelectedActor(null);
    setActorDetails(null);
  };

  const handleRemove = (actorId) => {
    setRemovingActorId(actorId);
    setTimeout(() => {
      setVisibleActors((prev) => prev.filter((actor) => actor.id !== actorId));
      unlikeActor(actorId);
      setRemovingActorId(null);
    }, 300);
  };

  return (
    <div>
      {visibleActors.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-6 max-w-6xl mx-auto">
          {visibleActors.map((actor) => (
            <div
              key={actor.id}
              className={`relative group bg-gray-800 rounded-lg overflow-hidden transition-transform duration-300 transform hover:scale-105 cursor-pointer ${
                removingActorId === actor.id
                  ? "opacity-0 transition-opacity duration-300"
                  : ""
              } w-1/2 sm:w-1/4 lg:w-1/4`}
            >
              <Link
                to={`/person/${actor.id}`}
                className="block"
                onClick={() => fetchActorDetails(actor.id)}
              >
                <img
                  src={
                    actor.image
                      ? `https://image.tmdb.org/t/p/w500/${actor.image}`
                      : "https://media.istockphoto.com/id/2170242955/vector/flat-illustration-avatar-user-profile-person-icon-gender-neutral-silhouette-profile-picture.jpg?s=612x612&w=0&k=20&c=fYMuoOFs_TEZ0__h2G_c86bqQ_4XRJ73ruRqTd8I4pQ="
                  }
                  alt={actor.name}
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <h3 className="text-lg font-semibold">{actor.name}</h3>
                </div>
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(actor.id);
                }}
                className="absolute bottom-2 left-[50%] transform -translate-x-1/2 flex items-center text-red-500 hover:text-red-400 transition duration-200"
              >
                <FaHeart className="mr-1" />
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-center py-[250px]">
          No one caught your eye? 😅
        </p>
      )}

      {selectedActor && actorDetails && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={closeDetails}>
              &times;
            </span>
            <h2>{actorDetails.name}</h2>
            <p>{actorDetails.biography}</p>
            <p>Birthday: {actorDetails.birthday}</p>
            <p>Known For: {actorDetails.known_for_department}</p>
            <img
              src={`https://image.tmdb.org/t/p/w500/${actorDetails.profile_path}`}
              alt={actorDetails.name}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LikedActors;
