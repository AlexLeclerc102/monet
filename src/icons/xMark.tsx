import { IconsProps } from "./type";

export default function XMark({
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
        d="M6 18 18 6M6 6l12 12"
      />
    </svg>
  );
}
