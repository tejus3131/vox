# Billing Reconciliation

## When to use

- Monthly billing audit
- Discrepancy reported between usage and invoice

## Steps

1. **Get usage totals for an org/period:**

```sql
SELECT org_id, 
  SUM(cost_paise) as total_paise,
  COUNT(*) as entry_count
FROM usage_ledger 
WHERE org_id = '<org_id>'
  AND created_at >= '<period_start>'
  AND created_at < '<period_end>'
GROUP BY org_id;
```

1. **Compare with invoice:**

```sql
SELECT id, total_paise, status 
FROM invoices 
WHERE org_id = '<org_id>' 
  AND period_start = '<period_start>';
```

1. **Check for duplicate ledger entries:**

```sql
SELECT idempotency_key, COUNT(*) 
FROM usage_ledger 
WHERE org_id = '<org_id>'
GROUP BY idempotency_key 
HAVING COUNT(*) > 1;
```

Should return 0 rows (idempotency_key is UNIQUE).

1. **If discrepancy found:**

   - Check webhook_events for payment event status/error
   - Verify Razorpay dashboard matches our records
   - Create adjustment invoice if needed

## Webhook triage

```sql
SELECT event_id, event_type, status, error_text, processed_at
FROM webhook_events
WHERE processed_at >= now() - interval '7 days'
ORDER BY processed_at DESC;
```

- `status = processed` should map to a deterministic invoice state change.
- `status = failed` means webhook parsing or invoice update failed and needs replay.

## Invoice state sanity

```sql
SELECT id, org_id, status, amount_due_paise, amount_paid_paise, razorpay_order_id, razorpay_payment_id, external_error
FROM invoices
WHERE created_at >= now() - interval '30 days'
ORDER BY created_at DESC;
```

## Manual period close trigger

For test-mode verification, call:

`POST /api/billing/close-period`

Body:

```json
{
  "orgId": "<org_id>"
}
```

Or use scheduled cron with:

`Authorization: Bearer $CRON_SECRET`
