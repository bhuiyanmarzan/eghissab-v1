import { Avatar, Badge, Card } from '../ui/primitives';
import { translateNode as t } from '../../lib/localization';
import type { CustomerRecord } from '../../lib/customer';
export function CustomerDetails({ row }: { row: CustomerRecord }) {
  const status =
    row.status === 'Complete' ? 'Verified' : row.status === 'Canceled' ? 'Rejected' : 'Pending';
  return (
    <div
      className="grid gap-5 p-5 lg:grid-cols-[300px_1fr]"
      aria-label={String(t('Customer Details'))}
    >
      <Card className="p-5">
        <div className="text-end">
          <Badge
            tone={row.status === 'Complete' ? 'green' : row.status === 'Canceled' ? 'red' : 'blue'}
          >
            {t(status)}
          </Badge>
        </div>
        <div className="flex flex-col items-center gap-2">
          {row.avatar ? (
            <img src={row.avatar} alt={row.name} className="size-16 rounded-full object-cover" />
          ) : (
            <Avatar name={row.name} size="lg" />
          )}
          <h3 className="text-lg font-semibold">{row.name}</h3>
          <p className="text-sm text-muted">{row.role || t('Customer')}</p>
        </div>
        <div className="my-5 flex justify-around text-center">
          <div className="text-lg font-semibold">
            {t(row.age)}
            <p className="text-xs font-normal text-muted">{t('Age')}</p>
          </div>
          {row.progress !== undefined && (
            <div>
              {t(row.progress)}%<p className="text-xs text-muted">{t('Progress')}</p>
            </div>
          )}
          {row.visits !== undefined && (
            <div>
              {t(row.visits)}
              <p className="text-xs text-muted">{t('Visits')}</p>
            </div>
          )}
        </div>
        <dl className="space-y-3 text-sm">
          {[
            ['Email', row.email],
            ['Phone', row.phone],
            ['Location', row.country],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted">{t(label)}</dt>
              <dd className="break-all">{value}</dd>
            </div>
          ))}
          {row.portfolio && /^https?:\/\//.test(row.portfolio) && (
            <div>
              <dt className="text-muted">{t('Portfolio')}</dt>
              <dd>
                <a href={row.portfolio} target="_blank" rel="noreferrer" className="text-primary">
                  {row.portfolio}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </Card>
      <div className="space-y-5">
        <Card className="p-5">
          <h3 className="mb-4 font-medium">{t('Personal Details')}</h3>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              ['Full Name', row.name],
              ['Father Name', row.fatherName],
              ['Country', row.country],
              ['Zip Code', row.zipCode],
              ['Address', row.location],
              ['Gender', row.gender],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted">{t(label)}</dt>
                <dd className="mt-1 whitespace-normal break-words">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-medium">{t('About me')}</h3>
          <p className="whitespace-pre-wrap text-sm text-muted">{row.about || '—'}</p>
          {!!row.skills?.length && (
            <div className="mt-4 flex flex-wrap gap-2">
              {row.skills.map((skill) => (
                <Badge key={skill} tone="gray">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
          {row.availableToHire && (
            <p className="mt-4 text-sm text-success">{t('Available to hire')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
