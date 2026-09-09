export default function ErrorMessage({ message = "불러오지 못했어요." }: { message?: string }) {
  return <p className="py-6 text-center text-xs text-bad">{message}</p>;
}
