import { Play } from "@/components/icons";
import { categoryTheme } from "@/lib/category-theme";
import { cn } from "@/lib/cn";

export function LessonPoster({
  category,
  length,
  title,
  size = "md",
  className,
  showPlay = true,
}: {
  category: string;
  length?: string | null;
  title?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showPlay?: boolean;
}) {
  const theme = categoryTheme(category);
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        size === "sm" && "aspect-[16/9] rounded-xl",
        size === "md" && "aspect-[16/9] rounded-t-[1.25rem]",
        size === "lg" && "aspect-[16/9] rounded-2xl",
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
      role="img"
      aria-label={title ? `Lesson preview: ${title}` : `Lesson in ${category}`}
    >
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${theme.ink}22 1px, transparent 0)`,
          backgroundSize: "16px 16px",
        }}
      />
      <span
        className="pointer-events-none absolute -right-2 bottom-[-18%] select-none font-display text-[7rem] font-semibold leading-none opacity-[0.18]"
        style={{ color: theme.ink }}
        aria-hidden="true"
      >
        {theme.glyph}
      </span>

      {showPlay && (
        <span
          className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-ink-2 shadow-soft backdrop-blur-sm"
          aria-hidden="true"
        >
          <Play size={18} />
        </span>
      )}

      {length && (
        <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[11.5px] font-medium text-white">
          {length}
        </span>
      )}
    </div>
  );
}
