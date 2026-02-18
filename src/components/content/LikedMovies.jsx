import React, { useEffect, useState } from "react";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import { UserAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { updateDoc, doc, onSnapshot } from "firebase/firestore";
import { AiOutlineClose } from "react-icons/ai";
import { Link } from "react-router-dom";

const LikedMovies = () => {
  const [movies, setMovies] = useState([]);
  const { user } = UserAuth();

  const slideLeft = () => {
    const slider = document.getElementById("slider");
    slider.scrollLeft -= 500;
  };

  const slideRight = () => {
    const slider = document.getElementById("slider");
    slider.scrollLeft += 500;
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "users", user?.email), (doc) => {
      setMovies(doc.data()?.savedContent || []);
    });
    return () => unsubscribe(); // Clean up subscription
  }, [user?.email]);

  const movieRef = doc(db, "users", user?.email);
  const deleteShow = async (passedID) => {
    try {
      const result = movies.filter((item) => item.id !== passedID);
      await updateDoc(movieRef, { savedContent: result });
    } catch (error) {
      console.error("Error removing movie:", error);
    }
  };

  return (
    <div>
      {movies.length > 0 ? (
        <div className="relative flex items-center group">
          <MdChevronLeft
            onClick={slideLeft}
            className="bg-white text-black left-0 rounded-full absolute opacity-40 hover:opacity-100 cursor-pointer z-10 hidden group-hover:block"
            size={40}
            aria-label="Slide left"
          />

          <div
            id="slider"
            className="w-full h-full overflow-x-scroll whitespace-nowrap scroll-smooth scrollbar-hide relative"
          >
            {movies
              .filter((item) => !item.type)
              .map((item) => (
                <div
                  key={item.id}
                  className="w-[160px] sm:w-[200px] md:w-[240px] lg:w-[280px] inline-block cursor-pointer relative p-2 transition-transform duration-300 hover:scale-105"
                >
                  <Link to={`/movies/${item.id}`} className="block">
                    <img
                      className="w-full h-auto block rounded-lg shadow-md"
                      src={`https://image.tmdb.org/t/p/w500/${item?.img}`}
                      alt={item?.title || item?.name}
                    />
                    <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity duration-300 text-white flex items-center justify-center">
                      <p className="whitespace-normal text-md md:text-sm font-bold text-center p-5 break-words">
                        {item?.title || item?.name}
                      </p>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteShow(item.id);
                    }}
                    className="absolute text-gray-300 top-4 right-4 hover:text-red-500 transition-colors duration-200"
                    aria-label={`Remove ${item.title || item.name}`}
                  >
                    <AiOutlineClose size={24} />
                  </button>
                </div>
              ))}
          </div>

          <MdChevronRight
            onClick={slideRight}
            className="bg-white text-black right-0 rounded-full absolute opacity-40 hover:opacity-100 cursor-pointer z-10 hidden group-hover:block"
            size={40}
            aria-label="Slide right"
          />
        </div>
      ) : (
        <p className="text-gray-400 text-center py-16">
          No Movies in Watchlist
        </p>
      )}
    </div>
  );
};

export default LikedMovies;
