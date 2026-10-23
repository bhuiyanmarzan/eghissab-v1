import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Printer } from 'lucide-react';
import { Button, Card, CardContent } from '../components/ui/primitives';
import { InvoiceDocument } from '../components/invoice/InvoiceDocument';
import { invoiceRecords, useInvoiceStore } from '../store/useInvoiceStore';
import { useTenantStore } from '../store/useTenantStore';
import { InvoiceCreateForm } from './InvoiceCreatePage';
import { translateNode } from '../lib/localization';

export function InvoiceRecordPage({ editing = false }: { editing?: boolean }) {
  useTranslation();
  const { invoiceId } = useParams();
  const tenant = useTenantStore((state) => state.selectedTenantId);
  const records = useInvoiceStore((state) => state.records[tenant]);
  const draft = useInvoiceStore((state) => state.drafts[tenant]);
  const invoice = useMemo(
    () =>
      invoiceRecords({ records: { [tenant]: records }, drafts: { [tenant]: draft } }, tenant).find(
        (item) => item.id === invoiceId,
      ),
    [tenant, records, draft, invoiceId],
  );
  if (!invoice)
    return (
      <Card>
        <CardContent>
          <p className="mb-4">{translateNode('Invoice not found')}</p>
          <Button asChild variant="outline">
            <Link to="/apps/invoice/list">{translateNode('Back to invoice list')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-4">
      <div className="invoice-record-controls flex flex-wrap justify-between gap-3">
        <Button asChild variant="outline">
          <Link to="/apps/invoice/list">
            <ArrowLeft className="size-4" />
            {translateNode('Back to invoice list')}
          </Link>
        </Button>
        {!editing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" />
              {translateNode('Print')}
            </Button>
            <Button asChild>
              <Link to={`/apps/invoice/edit/${encodeURIComponent(invoice.id)}`}>
                <Pencil className="size-4" />
                {translateNode('Edit')}
              </Link>
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <InvoiceCreateForm
          key={`${tenant}-${invoice.id}`}
          tenant={tenant}
          initialInvoice={invoice}
        />
      ) : (
        <Card className="invoice-record-document">
          <CardContent className="p-6 sm:p-8">
            <InvoiceDocument invoice={invoice} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
