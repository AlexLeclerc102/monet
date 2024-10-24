export function TogglableButtonGroup({
  texts,
  activeIndex,
  onClick,
}: {
  texts: string[];
  activeIndex: number;
  onClick: (index: number) => void;
}) {
  return (
    <div className="flex">
      {texts.map((text, index) => (
        <button
          key={index}
          className={`m-1 py-1 px-3 ${activeIndex === index ? "bg-emerald-600" : "bg-slate-700"} rounded-md text-white`}
          onClick={() => onClick(index)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
