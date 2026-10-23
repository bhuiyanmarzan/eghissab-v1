import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ColumnSizingState, VisibilityState } from '@tanstack/react-table';
export type TablePreferences = {
  rowOrder?: string[];
  columnOrder?: string[];
  visibility?: VisibilityState;
  sizes?: ColumnSizingState;
};
export const useReactTableStore = create<{
  preferences: Record<string, TablePreferences>;
  savePreferences: (key: string, values: TablePreferences) => void;
}>()(
  persist(
    (set) => ({
      preferences: {},
      savePreferences: (key, values) =>
        set((state) => ({
          preferences: { ...state.preferences, [key]: { ...state.preferences[key], ...values } },
        })),
    }),
    { name: 'mantis-react-table-preferences' },
  ),
);
