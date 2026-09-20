import type { ReactNode } from "react";

/**
 * A stylized tooth silhouette — not anatomically precise, but recognizably a tooth (crown +
 * root(s)) rather than an abstract numbered box. `anterior` (incisors/canines) gets a narrow
 * crown and a single root; `posterior` (premolars/molars) gets a wider crown and a twin root,
 * mirroring how a real odontogram distinguishes front and back teeth at a glance.
 */
export function ToothIcon({
  variant,
  fill,
  stroke,
  dashed,
  className,
}: {
  variant: "anterior" | "posterior";
  fill: string;
  stroke: string;
  dashed?: boolean;
  className?: string;
}): ReactNode {
  const strokeDasharray = dashed ? "1.5 1.5" : undefined;
  const opacity = fill === "none" ? 0.5 : 1;

  if (variant === "anterior") {
    return (
      <svg viewBox="0 0 20 32" className={className} aria-hidden="true" style={{ opacity }}>
        <path
          d="M4 2 Q4 0 6 0 H14 Q16 0 16 2 V11 Q16 17 10 17 Q4 17 4 11 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.1"
          strokeDasharray={strokeDasharray}
        />
        <path
          d="M7.5 16.5 Q6.5 23 8 29 Q9 31.5 10 29 Q11 23 12.5 16.5 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="0.9"
          strokeDasharray={strokeDasharray}
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 22 32" className={className} aria-hidden="true" style={{ opacity }}>
      <path
        d="M2 4 Q2 0 6 0 H16 Q20 0 20 4 V9 Q20 16 15.5 15 Q13.5 14.5 11 16 Q8.5 14.5 6.5 15 Q2 16 2 9 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.1"
        strokeDasharray={strokeDasharray}
      />
      <path
        d="M5.5 15.5 Q4.5 22 5.5 27.5 Q6.5 30 7.5 27 Q8.5 21.5 9.5 15.5 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="0.9"
        strokeDasharray={strokeDasharray}
      />
      <path
        d="M12.5 15.5 Q11.5 21.5 12.5 27 Q13.5 30 14.5 27.5 Q15.5 22 16.5 15.5 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="0.9"
        strokeDasharray={strokeDasharray}
      />
    </svg>
  );
}
