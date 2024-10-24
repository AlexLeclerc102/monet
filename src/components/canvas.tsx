import { useEffect, useRef, useState } from "react";
import { TogglableButtonGroup } from "./buttons";
import { useVideoFrames } from "../hooks/useVideoFrames";

interface CanvasProps {
  selectedVideo: string;
}

const canvasSize = { width: 800, height: 600 };

export function Canvas({ selectedVideo }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<"box" | "point_pos" | "point_neg">("box");
  const [boxes, setBoxes] = useState<
    { x: number; y: number; width: number; height: number }[]
  >([]);
  const [points, setPoints] = useState<
    { x: number; y: number; color: string }[]
  >([]);
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

    if (!backgroundImage) return;

    image.src = "data:image/jpeg;base64," + backgroundImage;
    image.onload = () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      context.strokeStyle = "red";
      context.lineWidth = 2;

      boxes.forEach((box) => {
        context.strokeRect(box.x, box.y, box.width, box.height);
      });

      points.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        context.fillStyle = point.color;
        context.fill();
      });
    };
  }, [backgroundImage, boxes, points]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (mode === "box") {
      setStartPos(pos);
      setIsDrawing(true);
    } else if (mode === "point_pos" || mode === "point_neg") {
      const color = mode === "point_pos" ? "blue" : "red";
      setPoints((prevPoints) => [...prevPoints, { ...pos, color }]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos || mode !== "box") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const currentPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const newBox = {
      x: startPos.x,
      y: startPos.y,
      width: currentPos.x - startPos.x,
      height: currentPos.y - startPos.y,
    };
    setBoxes((prevBoxes) => [...prevBoxes.slice(0, -1), newBox]);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setStartPos(null);
  };

  if (query.isPending) {
    return <div>Loading video...</div>;
  }

  if (query.isError) {
    return <div>{query.error.message}</div>;
  }

  return (
    <div className="m-5 ">
      <div className="text-2xl font-bold">Canvas</div>
      <div className="flex ">
        <button
          className="m-1 py-1 px-3 bg-red-600 rounded-md text-white"
          onClick={() => {
            setBoxes([]);
            setPoints([]);
          }}
        >
          Clear Canvas
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
          className="m-1 py-1 px-3 bg-blue-600 rounded-md text-white"
          onClick={prevFrame}
        >
          Prev
        </button>
        <button
          className="m-1 py-1 px-3 bg-blue-600 rounded-md text-white"
          onClick={nextFrame}
        >
          Next
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{ border: "1px solid black" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
}
