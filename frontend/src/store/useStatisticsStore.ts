import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { learningMembers } from '../data/statistics';
export const useStatisticsStore = create<{
  members: Record<string, string[]>;
  saveMembers: (tenant: string, ids: string[]) => void;
}>()(
  persist(
    (set) => ({
      members: {},
      saveMembers: (tenant, ids) =>
        set((s) => ({
          members: {
            ...s.members,
            [tenant]: [...new Set(ids)].filter((id) =>
              learningMembers.some((member) => member.id === id),
            ),
          },
        })),
    }),
    { name: 'mantis-statistics-widgets' },
  ),
);
