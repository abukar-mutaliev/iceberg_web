import { Segmented, DatePicker, Space, Grid } from 'antd';
import type { PeriodPreset } from '../model/period';
import { periodToQuery } from '../model/period';

const PRESETS: { label: string; value: PeriodPreset }[] = [
  { label: 'День', value: 'day' },
  { label: 'Неделя', value: 'week' },
  { label: 'Месяц', value: 'month' },
  { label: 'Год', value: 'year' },
];

interface PeriodFilterProps {
  preset: PeriodPreset;
  onChange: (next: ReturnType<typeof periodToQuery> & { preset: PeriodPreset }) => void;
}

export function PeriodFilter({ preset, onChange }: PeriodFilterProps) {
  const screens = Grid.useBreakpoint();
  return (
    <Space wrap size="middle">
      <Segmented
        size={screens.md ? 'middle' : 'small'}
        options={PRESETS}
        value={preset}
        onChange={(value) => {
          const next = periodToQuery(value as PeriodPreset);
          onChange({ ...next, preset: value as PeriodPreset });
        }}
      />
      <DatePicker
        onChange={(day) => {
          const date = day?.toDate() ?? new Date();
          onChange({ ...periodToQuery(preset, date), preset });
        }}
      />
    </Space>
  );
}
