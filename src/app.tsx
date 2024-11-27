import { useQueryClient } from "@tanstack/react-query";
import { Canvas } from "./components/canvas";
import { useState } from "react";
import { Upload } from "./components/upload";
import { SelectVideo } from "./components/selectVideo";
import { ApiAlive } from "./components/apiAlive";

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
          <Upload onUpload={onUpload} />
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
