import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const Search = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Icon>
);

export const ArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12h15" />
    <path d="m13 6 6 6-6 6" />
  </Icon>
);

export const ArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12H5" />
    <path d="m11 18-6-6 6-6" />
  </Icon>
);

export const Plus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const Check = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Icon>
);

export const Clock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const Bell = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" />
    <path d="M10.3 19a2 2 0 0 0 3.4 0" />
  </Icon>
);

export const Play = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" stroke="none" />
  </Icon>
);

export const PlayCircle = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5v7l5.5-3.5L10 8.5Z" fill="currentColor" stroke="none" />
  </Icon>
);

export const Video = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="6" width="13" height="12" rx="3" />
    <path d="m16 10 5-3v10l-5-3" />
  </Icon>
);

export const User = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.4 3.6-5.2 7-5.2s6.2 1.8 7 5.2" />
  </Icon>
);

export const Menu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const Close = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

export const ChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const ThumbUp = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 10.5V20H4.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1H7Z" />
    <path d="M7 10.5 11.2 4a2 2 0 0 1 2.4 1.3l.5 3.2h4.2a1.6 1.6 0 0 1 1.6 2l-1.4 7a2 2 0 0 1-2 1.5H7" />
  </Icon>
);

export const ThumbDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M17 13.5V4h2.5a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H17Z" />
    <path d="M17 13.5 12.8 20a2 2 0 0 1-2.4-1.3l-.5-3.2H5.7a1.6 1.6 0 0 1-1.6-2l1.4-7a2 2 0 0 1 2-1.5H17" />
  </Icon>
);

export const Lock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 1 1 7 0v2.5" />
  </Icon>
);

export const Globe = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.3 3.6 8.5S14.4 18.2 12 20.5c-2.4-2.3-3.6-5.3-3.6-8.5S9.6 5.8 12 3.5Z" />
  </Icon>
);

export const Calendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
  </Icon>
);

export const Sparkle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6Z" fill="currentColor" stroke="none" />
    <path d="M18.5 15.5c.3 1.7.9 2.3 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.2 2.2-.8 2.5-2.5Z" fill="currentColor" stroke="none" />
  </Icon>
);

export const Link = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
    <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
  </Icon>
);

export const External = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </Icon>
);

export const Mail = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <path d="m4 7.5 8 5.5 8-5.5" />
  </Icon>
);

export const LogOut = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 5.5H7.5A1.5 1.5 0 0 0 6 7v10a1.5 1.5 0 0 0 1.5 1.5H14" />
    <path d="M17 8.5 20.5 12 17 15.5M10 12h10" />
  </Icon>
);

export const Settings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="2.8" />
    <path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.9-1.1L14.4 3H9.6l-.3 2.4a7 7 0 0 0-1.9 1.1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.9 1.1l.3 2.4h4.8l.3-2.4a7 7 0 0 0 1.9-1.1l2.3 1 2-3.4-2-1.5c.1-.4.1-.7.1-1.1Z" />
  </Icon>
);

export const Inbox = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 13h4l1.5 3h6l1.5-3h4" />
    <path d="M5.5 5h13l2 8v5.5A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5V13l2-8Z" />
  </Icon>
);

export const Filter = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Icon>
);

export const Spinner = ({ className = "", size = 18 }: { className?: string; size?: number }) => (
  <svg
    className={`animate-spin ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const Compass = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </Icon>
);

export const Home = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" />
    <path d="M9.5 20.5v-6h5v6" />
  </Icon>
);

export const Book = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" />
  </Icon>
);
