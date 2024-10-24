import { IconsProps } from "./type";

export function ChevronDown({
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
        d="m4.5 5.25 7.5 7.5 7.5-7.5m-15 6 7.5 7.5 7.5-7.5"
      />
    </svg>
  );
}
