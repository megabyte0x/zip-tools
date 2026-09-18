import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <p>No ZIP matches</p>
      <p>
        <Link href="/zips">ZIP list</Link>
        {" · "}
        <a href="https://zips.z.cash">zips.z.cash</a>
      </p>
    </div>
  );
}
