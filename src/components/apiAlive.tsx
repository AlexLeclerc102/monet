import { useQuery } from "@tanstack/react-query";
import Check from "../icons/check";
import XMark from "../icons/xMark";

type AliveResponse = {
  alive: boolean;
};

function isAlive(): Promise<AliveResponse> {
  return fetch("/api")
    .then((res) => res.json())
    .then((data) => {
      return data;
    })
    .catch(() => {
      return { alive: false };
    });
}

export function ApiAlive() {
  const { status, data, error } = useQuery({
    queryKey: ["alive"],
    queryFn: isAlive,
  });

  if (status === "pending") {
    return <div>Loading...</div>;
  }

  if (status === "error") {
    return <div>Error: {error?.message}</div>;
  }

  return (
    <>
      {data.alive ? (
        <div className="mt-1 ml-3">
          <Check color="green" size={30} stroke={3} />
        </div>
      ) : (
        <div className="mt-1 ml-3">
          <XMark color="red" size={30} stroke={3} />
        </div>
      )}
    </>
  );
}
