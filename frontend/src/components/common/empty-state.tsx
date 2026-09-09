interface EmptyStateProps {
  message: string;
}

/** .emptyState — 점선 테두리 안내 박스 */
export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <p className="rounded-[12px] border border-dashed border-line px-2.5 py-[22px] text-center text-xs leading-relaxed text-ink-3">
      {message}
    </p>
  );
}
