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

2. **Compare with invoice:**
```sql
SELECT id, total_paise, status 
FROM invoices 
WHERE org_id = '<org_id>' 
  AND period_start = '<period_start>';
```

3. **Check for duplicate ledger entries:**
```sql
SELECT idempotency_key, COUNT(*) 
FROM usage_ledger 
WHERE org_id = '<org_id>'
GROUP BY idempotency_key 
HAVING COUNT(*) > 1;
```
Should return 0 rows (idempotency_key is UNIQUE).

4. **If discrepancy found:**
   - Check webhook_events for payment event status
   - Verify Razorpay dashboard matches our records
   - Create adjustment invoice if needed
