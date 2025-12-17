import type { CSSProperties, ReactNode } from "react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";

type VirtuosoRange = { start: number; end: number };

type VirtuosoProps<T> = {
  className?: string;
  data?: T[];
  itemContent: (index: number, item: T) => ReactNode;
  rangeChanged?: (range: VirtuosoRange) => void;
  style?: CSSProperties;
  totalCount?: number;
};

export const Virtuoso = forwardRef<HTMLDivElement, VirtuosoProps<unknown>>(function Virtuoso(
  { className, data, itemContent, rangeChanged, style, totalCount },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

  const items = useMemo(() => {
    if (Array.isArray(data)) {
      return data;
    }

    const count = totalCount ?? 0;
    return Array.from({ length: count }, (_, index) => index as unknown as unknown);
  }, [data, totalCount]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !rangeChanged) {
      return;
    }

    const handleScroll = () => {
      if (!container) {
        return;
      }

      const height = container.clientHeight || 1;
      const start = Math.max(0, Math.round(container.scrollTop / height));
      const end = Math.min(items.length - 1, start + 1);
      rangeChanged({ start, end });
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => container.removeEventListener("scroll", handleScroll);
  }, [items.length, rangeChanged]);

  return (
    <div className={className} ref={containerRef} style={{ overflowY: "auto", ...style }}>
      {items.map((item, index) => (
        <div key={index} style={{ minHeight: "100vh" }}>
          {itemContent(index, item as unknown as any)}
        </div>
      ))}
    </div>
  );
});

export default Virtuoso;
