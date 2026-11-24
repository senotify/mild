type P = { className?: string; size?: number };
const s = (size = 24) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const SearchIcon = ({ className, size }: P) => (
  <svg {...s(size)} className={className}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.3-4.3" /></svg>
);
export const WriteIcon = ({ className, size }: P) => (
  <svg {...s(size)} className={className}><path d="M14 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" /><path d="m10 14 1-4 8-8 3 3-8 8z" /></svg>
);
export const BellIcon = ({ className, size }: P) => (
  <svg {...s(size)} className={className}><path d="M15 18H5.5a1 1 0 0 1-.8-1.6L6 14.5V10a6 6 0 1 1 12 0v4.5l1.3 1.9a1 1 0 0 1-.8 1.6H15m0 0a3 3 0 1 1-6 0" /></svg>
);
export const ClapIcon = ({ className, size, filled }: P & { filled?: boolean }) => (
  <svg {...s(size)} className={className} fill={filled ? "currentColor" : "none"}>
    <path d="M7.5 11.5 5 9a1.4 1.4 0 0 1 2-2l4.5 4.5M9 9.5 6.8 7.3a1.4 1.4 0 0 1 2-2l4.7 4.7M11.2 7.8 10 6.6a1.4 1.4 0 0 1 2-2l5.2 5.2c2 2 2.4 5.5 0 7.9s-5.8 2.3-7.9.2L5.3 13.9a1.4 1.4 0 0 1 2-2l2 2" />
    <path d="M14 2.5V1M17 3.5l1-1M11.3 3.4l-1-1" />
  </svg>
);
export const ResponseIcon = ({ className, size }: P) => (
  <svg {...s(size)} className={className}><path d="M18 16.8a7.14 7.14 0 0 0 2.24-5.32c0-4.12-3.7-7.48-8.25-7.48S3.75 7.36 3.75 11.48c0 4.12 3.7 7.48 8.25 7.48.92 0 1.82-.14 2.66-.4l3.84 1.94-.5-3.7z" /></svg>
);
export const BookmarkIcon = ({ className, size, filled }: P & { filled?: boolean }) => (
  <svg {...s(size)} className={className} fill={filled ? "currentColor" : "none"}><path d="M17.5 3h-11a1 1 0 0 0-1 1v17l6.5-4.5 6.5 4.5V4a1 1 0 0 0-1-1z" /></svg>
);
export const ShareIcon = ({ className, size }: P) => (
  <svg {...s(size)} className={className}><path d="M15 6.5 12 3.5 9 6.5M12 4v11" /><path d="M8 10H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" /></svg>
);
export const StarIcon = ({ className, size }: P) => (
  <svg width={size ?? 15} height={size ?? 15} viewBox="0 0 64 64" className={className}><path fill="#FFC017" d="m39.64 40.83-7.64-4.6-7.64 4.6 2.02-8.69-6.73-5.82 8.88-.76L32 17.31l3.47 8.25 8.88.76-6.73 5.82z" /></svg>
);
