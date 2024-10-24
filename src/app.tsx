import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Canvas } from "./components/canvas";
import { useState } from "react";
import { UploadVideo } from "./components/uploadVideo";
import Check from "./icons/check";
import XMark from "./icons/xMark";

type AliveResponse = {
  alive: boolean;
};

type VideoResponse = {
  videos: string[];
};

function isAlive(): Promise<AliveResponse> {
  return fetch("/api")
    .then((res) => res.json())
    .then((data) => {
      return data;
    })
    .catch(() => {
      return { alive: false };
    });
}

export default function App() {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const onUpload = () => {
    queryClient.invalidateQueries({ queryKey: ["videos"] });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="container mx-auto">
        <h1 className="flex justify-center items-center text-3xl font-bold mb-6 text-center">
          My App <ApiAlive />
        </h1>
        <hr className="mb-6" />
        <div className="mb-6">
          <UploadVideo onUpload={onUpload} />
        </div>
        <div className="mb-6">
          <SelectVideo onSelect={setSelectedVideo} />
        </div>
        {selectedVideo && (
          <div className="mt-6">
            <Canvas selectedVideo={selectedVideo} />
          </div>
        )}
      </div>
    </div>
  );
}

function SelectVideo({ onSelect }: { onSelect: (video: string) => void }) {
  const { status, data, error } = useQuery<VideoResponse>({
    queryKey: ["videos"],
    queryFn: () =>
      fetch("/api/videos")
        .then((res) => res.json())
        .then((data) => data),
  });

  if (status === "pending") {
    return <div>Loading videos...</div>;
  }

  if (status === "error") {
    return <div>Error loading videos: {error?.message}</div>;
  }

  return (
    <div className="mt-3 p-4 bg-white shadow rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Select a Video</h2>
      <ul className="space-y-2">
        {data.videos.map((video: string) => (
          <li
            key={video}
            onClick={() => onSelect(video)}
            className="cursor-pointer p-2 hover:bg-gray-100 rounded transition"
          >
            {video}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApiAlive() {
  const { status, data, error } = useQuery({
    queryKey: ["alive"],
    queryFn: isAlive,
  });

  if (status === "pending") {
    return <div>Loading...</div>;
  }

  if (status === "error") {
    return <div>Error: {error?.message}</div>;
  }

  return (
    <>
      {data.alive ? (
        <div className="mt-1 ml-3">
          <Check color="green" size={30} stroke={3} />
        </div>
      ) : (
        <div className="mt-1 ml-3">
          <XMark color="red" size={30} stroke={3} />
        </div>
      )}
    </>
  );
}
