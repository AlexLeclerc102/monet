import { useEffect, useRef, useState } from "react";
import { TogglableButtonGroup } from "./buttons";
import { fetchVideoFrame, useVideoFrames } from "../hooks/useVideoFrames";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Annotation } from "../types/canvas";
import SegModal from "./segModal";
import ChangeFrameModal from "./frameModal";

interface CanvasProps {
  selectedVideo: string;
}

const postAnnotation = async (annotation: Annotation) => {
  await axios.post(
    `/api/videos/${annotation.videoName}/annotations/${annotation.frameNumber}`,
    annotation
  );
};

export function Canvas({ selectedVideo }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<"box" | "point_pos" | "point_neg">("box");
  const [frameData, setFrameData] = useState<Record<number, Annotation>>({});
  const [startPos, setStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const maxCanvasSize = {
    width: Math.round(window.innerWidth * 0.8),
    height: Math.round(window.innerHeight * 0.8),
  };
  const [canvasSize, setCanvasSize] = useState({
    width: 0,
    height: 0,
  });
  const { query, nextFrame, prevFrame, setFrame } = useVideoFrames(
    selectedVideo,
    maxCanvasSize.height,
    maxCanvasSize.width
  );

  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundSegmentedImage, setBackgroundSegmentedImage] = useState<
    string | null
  >(null);
  const [useSegmentedImage, setUseSegmentedImage] = useState(false);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (info: Annotation) => postAnnotation(info),
  });

  useEffect(() => {
    if (query.data) {
      setBackgroundImage(query.data.image);
      setBackgroundSegmentedImage(query.data.segmented_image);
      setFrameData((prevFrameData) => ({
        ...prevFrameData,
        [query.data.frame_number]: query.data.annotation,
      }));

      const { width, height } = query.data;
      setCanvasSize({
        width: width,
        height: height,
      });
    }
  }, [query.data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const image = new Image();

    if (!backgroundImage || !query.data) return;

    if (useSegmentedImage && backgroundSegmentedImage) {
      image.src = "data:image/jpeg;base64," + backgroundSegmentedImage;
    } else {
      image.src = "data:image/jpeg;base64," + backgroundImage;
    }

    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      context.strokeStyle = "red";
      context.lineWidth = 2;

      const currentFrameData = frameData[query.data.frame_number] || {
        box: null,
        positivePoints: [],
        negativePoints: [],
      };

      if (currentFrameData.box) {
        const { x: x, y: y, width, height } = currentFrameData.box;
        context.strokeRect(
          x * canvas.width,
          y * canvas.height,
          width * canvas.width,
          height * canvas.height
        );
      }

      currentFrameData.positivePoints.forEach((point) => {
        context.beginPath();
        context.arc(
          point.x * canvas.width,
          point.y * canvas.height,
          5,
          0,
          2 * Math.PI
        );
        context.fillStyle = "blue";
        context.fill();
      });

      currentFrameData.negativePoints.forEach((point) => {
        context.beginPath();
        context.arc(
          point.x * canvas.width,
          point.y * canvas.height,
          5,
          0,
          2 * Math.PI
        );
        context.fillStyle = "red";
        context.fill();
      });
    };
  }, [
    backgroundImage,
    frameData,
    query.data?.frame_number,
    useSegmentedImage,
    canvasSize,
  ]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !query.data) return;
    const pos = {
      x: (e.clientX - rect.left) / canvasSize.width,
      y: (e.clientY - rect.top) / canvasSize.height,
    };

    if (mode === "box") {
      setStartPos(pos);
      setIsDrawing(true);
    } else if (mode === "point_pos" || mode === "point_neg") {
      const currentFrameNumber = query.data.frame_number;
      const newFrameData = {
        ...frameData,
        [currentFrameNumber]: {
          ...frameData[currentFrameNumber],
          frameNumber: currentFrameNumber,
          videoName: selectedVideo,
          positivePoints:
            mode === "point_pos"
              ? [...(frameData[currentFrameNumber]?.positivePoints || []), pos]
              : frameData[currentFrameNumber]?.positivePoints || [],
          negativePoints:
            mode === "point_neg"
              ? [...(frameData[currentFrameNumber]?.negativePoints || []), pos]
              : frameData[currentFrameNumber]?.negativePoints || [],
        },
      };
      setFrameData(newFrameData);
      mutation.mutate(newFrameData[currentFrameNumber]);
      queryClient.invalidateQueries({
        queryKey: ["video_frames", selectedVideo, currentFrameNumber],
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos || mode !== "box" || !query.data) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const currentPos = {
      x: (e.clientX - rect.left) / canvasSize.width,
      y: (e.clientY - rect.top) / canvasSize.height,
    };
    const newBox = {
      x: startPos.x,
      y: startPos.y,
      width: currentPos.x - startPos.x,
      height: currentPos.y - startPos.y,
    };
    const currentFrameNumber = query.data.frame_number;
    const newFrameData = {
      ...frameData,
      [currentFrameNumber]: {
        ...frameData[currentFrameNumber],
        frameNumber: currentFrameNumber,
        videoName: selectedVideo,
        box: newBox,
      },
    };
    setFrameData(newFrameData);
  };

  const handleMouseUp = () => {
    if (isDrawing && startPos && mode === "box" && query.data) {
      const currentFrameNumber = query.data.frame_number;
      mutation.mutate(frameData[currentFrameNumber]);
      queryClient.invalidateQueries({
        queryKey: ["video_frames", selectedVideo, currentFrameNumber],
      });
    }
    setIsDrawing(false);
    setStartPos(null);
  };

  const handleNextFrame = () => {
    nextFrame();
    if (query.data) {
      setTimeout(() => prefetchNextFrame(query.data.frame_number + 2), 200);
    }
  };

  const prefetchNextFrame = (frameNumber?: number) => {
    if (!query.data) return;
    const nextFrameNumber = frameNumber ?? query.data.frame_number + 1;
    queryClient.prefetchQuery({
      queryKey: ["video_frames", selectedVideo, nextFrameNumber],
      queryFn: () =>
        fetchVideoFrame(
          selectedVideo,
          nextFrameNumber,
          canvasSize.height,
          canvasSize.width
        ),
      staleTime: 1000 * 60 * 60,
    });
  };

  const handlePrevFrame = () => {
    prevFrame();
  };

  const handleClear = () => {
    if (query.isPending || query.isError) return;
    const currentFrameNumber = query.data.frame_number;
    const clearedFrameData = {
      videoName: selectedVideo,
      frameNumber: currentFrameNumber,
      box: null,
      positivePoints: [],
      negativePoints: [],
    } as Annotation;
    setFrameData((prevFrameData) => ({
      ...prevFrameData,
      [currentFrameNumber]: clearedFrameData,
    }));
    mutation.mutate(clearedFrameData);
    queryClient.invalidateQueries({
      queryKey: ["video_frames", selectedVideo, currentFrameNumber],
    });
  };

  if (query.isError) {
    return <div>{query.error.message}</div>;
  }

  return (
    <div className="inline-block p-4 bg-white shadow rounded-lg">
      <div className="text-2xl font-bold flex items-center">
        Canvas - Frame {query.isPending ? "*" : query.data.frame_number}
        {query.isPending ? (
          ""
        ) : (
          <ChangeFrameModal
            frame_number={query.data.frame_number}
            setFrame={setFrame}
          />
        )}
      </div>
      <div className="flex justify-center pb-2">
        <button
          className="m-1 py-1 px-3 bg-red-600 rounded-md text-white"
          onClick={handleClear}
        >
          Clear
        </button>
        <TogglableButtonGroup
          texts={["Draw Boxes", "Draw Positive Points", "Draw Negative Points"]}
          activeIndex={mode === "box" ? 0 : mode === "point_pos" ? 1 : 2}
          onClick={(index) =>
            setMode(
              index === 0 ? "box" : index === 1 ? "point_pos" : "point_neg"
            )
          }
        />
        <button
          className="m-1 py-1 px-3 bg-violet-700 rounded-md text-white"
          onClick={() => {
            setUseSegmentedImage((prev) => !prev);
          }}
        >
          {useSegmentedImage ? "Use Original Image" : "Use Segmented Image"}
        </button>
        {useSegmentedImage && !backgroundSegmentedImage ? (
          <div className="m-1 font-bold border-2 border-solid p-1 shadow-md rounded-md">
            No Segmented Image
          </div>
        ) : (
          ""
        )}
      </div>
      {query.isPending ? (
        <div
          className="bg-gray-300 rounded-md"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        ></div>
      ) : (
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
      )}
      <div className="flex justify-center">
        <button
          className="m-1 py-1 px-3 bg-cyan-700 rounded-md text-white"
          onClick={handlePrevFrame}
        >
          Prev
        </button>
        {query && query.data ? (
          <SegModal
            selectedVideo={selectedVideo}
            frame_number={query.data.frame_number}
          />
        ) : (
          ""
        )}
        <button
          className="m-1 py-1 px-3 bg-cyan-700 rounded-md text-white"
          onClick={handleNextFrame}
          onMouseEnter={() => {
            prefetchNextFrame();
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
