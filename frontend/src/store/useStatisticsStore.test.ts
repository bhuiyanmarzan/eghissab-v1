import { beforeEach, describe, expect, it } from 'vitest';
import { useStatisticsStore } from './useStatisticsStore';
beforeEach(() => useStatisticsStore.setState({ members: {} }));
describe('Statistics preferences', () => {
  it('validates member identifiers and saves each tenant separately', () => {
    useStatisticsStore.getState().saveMembers('acme', ['cindy', 'cindy', 'unknown']);
    useStatisticsStore.getState().saveMembers('globex', ['remy']);
    expect(useStatisticsStore.getState().members).toEqual({ acme: ['cindy'], globex: ['remy'] });
  });
  it('persists and rehydrates saved teams including an intentionally empty team', async () => {
    useStatisticsStore.getState().saveMembers('acme', []);
    useStatisticsStore.getState().saveMembers('globex', ['cindy']);
    const persisted = localStorage.getItem('mantis-statistics-widgets')!;
    useStatisticsStore.setState({ members: {} });
    localStorage.setItem('mantis-statistics-widgets', persisted);
    await useStatisticsStore.persist.rehydrate();
    expect(useStatisticsStore.getState().members).toEqual({ acme: [], globex: ['cindy'] });
  });
});
