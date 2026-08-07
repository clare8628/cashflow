import type { ReactNode } from "react";

const ICON_PATHS: Record<string, ReactNode> = {
  飲食: (
    <>
      <rect x="4.5" y="6" width="9" height="9.5" rx="1.5" />
      <path d="M13.5 8.2h1a2.3 2.3 0 0 1 0 4.6h-1" />
    </>
  ),
  交通: (
    <>
      <path d="M5 9.5l1.3-2.8A1.5 1.5 0 0 1 7.7 5.8h4.6a1.5 1.5 0 0 1 1.4 1L15 9.5" />
      <rect x="3" y="9.5" width="14" height="5.5" rx="2" />
      <circle cx="6.5" cy="15.3" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="15.3" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  採買日用: (
    <>
      <path d="M5.5 7h9l-.8 9.5a1 1 0 0 1-1 .9H7.3a1 1 0 0 1-1-.9L5.5 7Z" />
      <path d="M7.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
    </>
  ),
  "3C用品": (
    <>
      <rect x="5" y="5" width="10" height="10" rx="2" />
      <circle cx="10" cy="10" r="2" />
    </>
  ),
  醫療保健: <path d="M10 4.5v11M4.5 10h11" strokeWidth={2.5} />,
  娛樂旅遊: (
    <path
      d="M10 3.3l1.7 3.6 3.9.5-2.9 2.7.8 3.9-3.5-1.9-3.5 1.9.8-3.9-2.9-2.7 3.9-.5L10 3.3Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  服飾: (
    <path d="M7 4.2L4 6.4l1.6 2.2L7 8v8.5h6V8l1.4.6L16 6.4l-3-2.2-1 .9H8l-1-.9Z" />
  ),
  其它: (
    <>
      <circle cx="6" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14" cy="10" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
};

export default function CategoryIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name] ?? ICON_PATHS["其它"]}
    </svg>
  );
}
