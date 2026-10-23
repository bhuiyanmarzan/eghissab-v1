import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, X } from 'lucide-react';
import { Button, Card } from '../ui/primitives';
import { learningMembers, initialLearningMembers } from '../../data/statistics';
import { useStatisticsStore } from '../../store/useStatisticsStore';
import { translateNode as t, translateString as ts } from '../../lib/localization';
export function LearningWidget({ tenant }: { tenant: string }) {
  const saved = useStatisticsStore((s) => s.members[tenant]) ?? initialLearningMembers;
  const save = useStatisticsStore((s) => s.saveMembers);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const members = learningMembers.filter((m) => saved.includes(m.id));
  return (
    <Card
      className="grid overflow-hidden sm:grid-cols-[1.4fr_1fr]"
      aria-label={ts('Learning progress')}
    >
      <div className="statistics-learning relative min-h-[245px] overflow-hidden bg-[#3b76ff] p-5 text-white">
        <h2 className="relative z-10 text-base font-semibold">
          {t('What would you want to learn today')}
        </h2>
        <p className="relative z-10 mt-2 max-w-[230px] text-xs leading-5">
          {t('Your learning capacity is 80% as daily analytics')}
        </p>
        <div className="relative z-10 mt-14 max-w-[200px]">
          <p className="mb-2 text-xl font-medium">{t('35% Completed')}</p>
          <div
            role="progressbar"
            aria-label={ts('Learning completion')}
            aria-valuenow={35}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 overflow-hidden rounded-full bg-white/60"
          >
            <div className="h-full w-[35%] bg-[#52c41a]" />
          </div>
        </div>
        <img
          src="/statistics/reader.svg"
          alt=""
          className="pointer-events-none absolute bottom-0 end-0 w-[210px]"
        />
      </div>
      <div className="p-5">
        <h3 className="text-sm font-medium">{t('Get started with new basic skills')}</h3>
        <p className="mt-2 text-sm text-muted">{t('Last Date 5th Nov 2020')}</p>
        <div className="my-6 flex items-center justify-between gap-3 border-t border-border pt-5">
          <div className="flex -space-x-2" aria-label={ts('Learning team')}>
            {members.slice(0, 3).map((member) => (
              <img
                key={member.id}
                src={member.avatar}
                alt={member.name}
                title={member.name}
                className="size-8 rounded-full border-2 border-surface object-cover"
              />
            ))}
            {members.length > 3 && (
              <span
                className="grid size-8 place-items-center rounded-full border-2 border-surface bg-muted text-xs text-white"
                title={members
                  .slice(3)
                  .map((m) => m.name)
                  .join(',')}
              >
                +{t(members.length - 3)}
              </span>
            )}
            {!members.length && <span className="text-xs text-muted">{t('No team members')}</span>}
          </div>
          <Button
            size="icon"
            aria-label={ts('Manage learning team')}
            onClick={() => {
              setDraft([...saved]);
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted">
          {t('Chrome fixed the bug several versions ago, thus rendering this...')}
        </p>
      </div>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40" />
          <Dialog.Content
            aria-describedby="learning-team-description"
            className="fixed left-1/2 top-1/2 z-[90] max-h-[85dvh] w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg bg-surface p-6 text-ink shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <Dialog.Title className="text-xl font-semibold">{t('Learning team')}</Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label={ts('Close dialog')}>
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
            <Dialog.Description id="learning-team-description" className="mb-5 text-sm text-muted">
              {t('Choose the people assigned to this learning activity.')}
            </Dialog.Description>
            {learningMembers.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-3 border-b border-border py-3"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={draft.includes(m.id)}
                  onChange={(e) =>
                    setDraft((ids) =>
                      e.target.checked ? [...ids, m.id] : ids.filter((id) => id !== m.id),
                    )
                  }
                />
                <img src={m.avatar} alt="" className="size-8 rounded-full object-cover" />
                <span className="text-sm">{m.name}</span>
              </label>
            ))}
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button
                onClick={() => {
                  save(tenant, draft);
                  setOpen(false);
                }}
              >
                {t('Save')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Card>
  );
}
