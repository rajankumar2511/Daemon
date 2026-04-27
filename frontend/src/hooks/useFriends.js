import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

export const useFriends = () => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await apiRequest("/friends/friendslist");

        console.log("FRIENDS RESPONSE:", res); // will be ARRAY

        setFriends(res || []);
      } catch (err) {
        console.error("Failed to fetch friends:", err);
        setError(err);
        setFriends([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();
  }, []);

  return { friends, loading, error };
};
