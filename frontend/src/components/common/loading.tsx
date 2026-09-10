export default function Loading({ label = "불러오는 중..." }: { label?: string }) {
  return <p className="lbl py-6 text-center">{label}</p>;
}
