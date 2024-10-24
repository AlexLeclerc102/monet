import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface VideoFrame {
  frame_number: number;
  image: string;
}
async function fetchVideoFrame(
  video: string,
  frame_number: number,
  height: number,
  width: number
) {
  try {
    const res = await fetch(
      `/api/videos/${video}/frame/${frame_number}?height=${height}&width=${width}`
    );
    if (!res.ok) {
      throw new Error(res.statusText);
    }
    const data = await res.json();
    return data;
  } catch (error: any) {
    throw new Error(error);
  }
}

export function useVideoFrames(
  video: string,
  height: number = 480,
  width: number = 640
) {
  const [frame_number, setFrameNumber] = useState(0);

  const nextFrame = () => {
    setFrameNumber((prev) => prev + 1);
  };

  const prevFrame = () => {
    setFrameNumber((prev) => prev - 1);
  };

  const query = useQuery<VideoFrame>({
    queryKey: ["video_frames", video, frame_number],
    queryFn: () => fetchVideoFrame(video, frame_number, height, width),
  });

  return { query, nextFrame, prevFrame };
}