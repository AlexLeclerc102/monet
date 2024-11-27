import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Annotation } from "../types/canvas";
import axios from "axios";

interface VideoFrame {
  frame_number: number;
  image: string;
  segmented_image: string | null;
  annotation: Annotation;
  width: number;
  height: number;
}

export async function fetchVideoFrame(
  video: string,
  frame_number: number,
  max_height: number,
  max_width: number
) {
  try {
    const res = await axios.get(`/api/videos/${video}/frame/${frame_number}`, {
      params: { max_height: max_height, max_width: max_width },
    });
    return res.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message);
  }
}

export function useVideoFrames(
  video: string,
  max_height: number = 480,
  max_width: number = 640
) {
  const [frame_number, setFrameNumber] = useState(0);

  const nextFrame = () => {
    setFrameNumber((prev) => prev + 1);
  };

  const prevFrame = () => {
    setFrameNumber((prev) => prev - 1);
  };

  const setFrame = (frame: number) => {
    setFrameNumber(frame);
  };

  const query = useQuery<VideoFrame>({
    queryKey: ["video_frames", video, frame_number],
    queryFn: () => fetchVideoFrame(video, frame_number, max_height, max_width),
    staleTime: 5,
  });

  return { query, nextFrame, prevFrame, setFrame };
}
