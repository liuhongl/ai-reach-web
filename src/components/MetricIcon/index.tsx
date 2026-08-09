import * as React from 'react';
import { theme } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

export type MetricTone =
  | 'primary'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'neutral';

export const useMetricToneColors = (_tone: MetricTone = 'primary') => {
  const { token } = theme.useToken();
  return {
    color: token.colorPrimary,
    backgroundColor: token.colorPrimaryBg,
  };
};

type MetricIconProps = {
  icon: ReactNode;
  tone?: MetricTone;
  className?: string;
  style?: CSSProperties;
  ariaHidden?: boolean;
};

export default function MetricIcon({
  icon,
  tone = 'primary',
  className = 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm',
  style,
  ariaHidden = true,
}: MetricIconProps) {
  const colors = useMetricToneColors(tone);
  return (
    <span
      aria-hidden={ariaHidden}
      className={className}
      style={{ ...colors, ...style }}
    >
      {icon}
    </span>
  );
}
