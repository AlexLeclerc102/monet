import { useEffect, useRef, useState } from "react";
import { TogglableButtonGroup } from "./buttons";
import { useVideoFrames } from "../hooks/useVideoFrames";

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
  color: string;
}

interface FrameData {
  boxes: Box[];
  points: Point[];
}

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
        boxes: [],
        points: [],
      };

      currentFrameData.boxes.forEach((box) => {
        context.strokeRect(box.x, box.y, box.width, box.height);
      });

      currentFrameData.points.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        context.fillStyle = point.color;
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
      const color = mode === "point_pos" ? "blue" : "red";
      const currentFrameNumber = query.data.frame_number;
      setFrameData((prevFrameData) => {
        const currentFrameData = prevFrameData[currentFrameNumber] || {
          boxes: [],
          points: [],
        };
        return {
          ...prevFrameData,
          [currentFrameNumber]: {
            ...currentFrameData,
            points: [...currentFrameData.points, { ...pos, color }],
          },
        };
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
    setFrameData((prevFrameData) => {
      const currentFrameData = prevFrameData[currentFrameNumber] || {
        boxes: [],
        points: [],
      };
      return {
        ...prevFrameData,
        [currentFrameNumber]: {
          ...currentFrameData,
          boxes: [...currentFrameData.boxes.slice(0, -1), newBox],
        },
      };
    });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setStartPos(null);
  };

  const handleNextFrame = () => {
    nextFrame();
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
            setFrameData((prevFrameData) => ({
              ...prevFrameData,
              [currentFrameNumber]: { boxes: [], points: [] },
            }));
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
        >
          Next
        </button>
      </div>
    </div>
  );
}
