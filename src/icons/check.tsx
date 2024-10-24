import { IconsProps } from "./type";

export default function Check({
  size = 24,
  color = "currentColor",
  stroke = 1.5,
}: IconsProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={stroke}
      stroke={color}
      width={size}
      height={size}
      className={`size-${size}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 12.75 6 6 9-13.5"
      />
    </svg>
  );
}
