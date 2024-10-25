import { useEffect, useRef, useState } from "react";
import { TogglableButtonGroup } from "./buttons";
import { fetchVideoFrame, useVideoFrames } from "../hooks/useVideoFrames";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import axios from "axios";

interface CanvasProps {
  selectedVideo: string;
}

const canvasSize = { width: 800, height: 600 };

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface FrameData {
  box: Box | null;
  positivePoints: Point[];
  negativePoints: Point[];
}

interface postAnnotationData {
  videoName: string;
  frameNumber: number;
  data: FrameData;
}

const postAnnotation = async ({
  videoName,
  frameNumber,
  data,
}: postAnnotationData) => {
  await axios
    .post(`/api/videos/${videoName}/annotations/${frameNumber}`, data)
    .then((res) => {
      console.log(res);
    });
};

export function Canvas({ selectedVideo }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<"box" | "point_pos" | "point_neg">("box");
  const [frameData, setFrameData] = useState<Record<number, FrameData>>({});
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const { query, nextFrame, prevFrame } = useVideoFrames(
    selectedVideo,
    canvasSize.height,
    canvasSize.width
  );

  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (info: postAnnotationData) => postAnnotation(info),
  });

  useEffect(() => {
    if (query.data) {
      setBackgroundImage(query.data.image);
    }
  }, [query.data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const image = new Image();

    if (!backgroundImage || !query.data) return;

    image.src = "data:image/jpeg;base64," + backgroundImage;
    image.onload = () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      context.strokeStyle = "red";
      context.lineWidth = 2;

      const currentFrameData = frameData[query.data.frame_number] || {
        box: null,
        positivePoints: [],
        negativePoints: [],
      };

      if (currentFrameData.box) {
        const { x, y, width, height } = currentFrameData.box;
        context.strokeRect(x, y, width, height);
      }

      currentFrameData.positivePoints.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        context.fillStyle = "blue";
        context.fill();
      });

      currentFrameData.negativePoints.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        context.fillStyle = "red";
        context.fill();
      });
    };
  }, [backgroundImage, frameData, query.data?.frame_number]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !query.data) return;
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (mode === "box") {
      setStartPos(pos);
      setIsDrawing(true);
    } else if (mode === "point_pos" || mode === "point_neg") {
      const currentFrameNumber = query.data.frame_number;
      const newFrameData = {
        ...frameData,
        [currentFrameNumber]: {
          ...frameData[currentFrameNumber],
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
      mutation.mutate({
        videoName: selectedVideo,
        frameNumber: currentFrameNumber,
        data: newFrameData[currentFrameNumber],
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos || mode !== "box" || !query.data) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const currentPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
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
        box: newBox,
      },
    };
    setFrameData(newFrameData);
  };

  const handleMouseUp = () => {
    if (isDrawing && startPos && mode === "box" && query.data) {
      const currentFrameNumber = query.data.frame_number;
      mutation.mutate({
        videoName: selectedVideo,
        frameNumber: currentFrameNumber,
        data: frameData[currentFrameNumber],
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

  if (query.isError) {
    return <div>{query.error.message}</div>;
  }

  return (
    <div className="inline-block p-4 bg-white shadow rounded-lg">
      <div className="text-2xl font-bold ">
        Canvas - Frame {query.isPending ? "*" : query.data.frame_number}
      </div>
      <div className="flex justify-center">
        <button
          className="m-1 py-1 px-3 bg-red-600 rounded-md text-white"
          onClick={() => {
            if (query.isPending) return;
            const currentFrameNumber = query.data.frame_number;
            const clearedFrameData = {
              box: null,
              positivePoints: [],
              negativePoints: [],
            };
            setFrameData((prevFrameData) => ({
              ...prevFrameData,
              [currentFrameNumber]: clearedFrameData,
            }));
            mutation.mutate({
              videoName: selectedVideo,
              frameNumber: currentFrameNumber,
              data: clearedFrameData,
            });
          }}
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
