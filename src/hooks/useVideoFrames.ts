import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Annotation } from "../types/canvas";

interface VideoFrame {
  frame_number: number;
  image: string;
  segmented_image: string | null;
  annotation: Annotation;
}

export async function fetchVideoFrame(
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
    console.log("Data", data);
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
    staleTime: 1000 * 60 * 60,
  });

  return { query, nextFrame, prevFrame };
}
