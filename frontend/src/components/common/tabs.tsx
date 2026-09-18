interface TabsProps<T extends string> {
  items: ReadonlyArray<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
}

/** .tabs — 패널 내부 탭 */
export default function Tabs<T extends string>({ items, value, onChange }: TabsProps<T>) {
  return (
    <div role="tablist" className="flex gap-1 rounded-box-sm border border-line bg-white/[.04] p-[3px]">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={value === item.key}
          onClick={() => onChange(item.key)}
          className={`flex-1 rounded-[9px] px-1 py-[7px] text-xs transition-colors duration-fast ${
            value === item.key ? "bg-white/[.09] text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
