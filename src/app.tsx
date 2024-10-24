import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Canvas } from "./components/canvas";
import { useState } from "react";
import { UploadVideo } from "./components/uploadVideo";
import Check from "./icons/check";
import XMark from "./icons/xMark";
import { SelectVideo } from "./components/selectVideo";

type AliveResponse = {
  alive: boolean;
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
        <h1 className="flex justify-center items-center text-3xl font-bold mb-4 pb-2 text-center border-b-2 ">
          Les devs sont mous <ApiAlive />
        </h1>
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
