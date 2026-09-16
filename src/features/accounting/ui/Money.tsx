import { Typography } from 'antd';
import { formatPrice } from '@/shared/lib';

interface MoneyProps {
  value?: number | null;
  hidden?: boolean;
}

export function Money({ value, hidden }: MoneyProps) {
  if (hidden) return <Typography.Text type="secondary">—</Typography.Text>;
  return <>{formatPrice(value)}</>;
}
