import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronUp } from "../icons/chevronUp";
import { ChevronDown } from "../icons/chevronDown";

type VideoResponse = {
  videos: string[];
  count: number;
  videos_sizes: number[]; // in bytes
};

export function SelectVideo({
  onSelect,
}: {
  onSelect: (video: string) => void;
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const { status, data, error } = useQuery<VideoResponse>({
    queryKey: ["videos"],
    queryFn: () =>
      fetch("/api/videos")
        .then((res) => res.json())
        .then((data) => data),
  });

  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  if (status === "pending") {
    return <div>Loading videos...</div>;
  }

  if (status === "error") {
    return <div>Error loading videos: {error?.message}</div>;
  }

  return (
    <div className="mt-3 p-4 bg-white shadow rounded-lg">
      <h2
        className="text-2xl font-bold mb-2 cursor-pointer flex items-center justify-between"
        onClick={toggleDrawer}
      >
        Select a Video {isDrawerOpen ? <ChevronUp /> : <ChevronDown />}
      </h2>
      {isDrawerOpen && (
        <ul className="space-y-2">
          {data.videos.map((video: string) => (
            <li
              key={video}
              onClick={() => onSelect(video)}
              className="cursor-pointer p-2 hover:bg-gray-100 rounded transition"
            >
              {video} -{" "}
              {(
                data.videos_sizes[data.videos.indexOf(video)] /
                (1024 * 1024)
              ).toFixed(2)}{" "}
              MB
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
