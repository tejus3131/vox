# Webhook Replay

## When to use
- Razorpay webhook delivery failed
- Payment status out of sync

## Steps

1. **Check webhook_events table:**
```sql
SELECT event_id, event_type, processed_at 
FROM webhook_events 
WHERE event_id = '<event_id>';
```

2. **If event was already processed:** No action needed. Our handler is idempotent.

3. **If event was NOT processed:**
   - Retrieve event payload from Razorpay dashboard (Events section)
   - Replay via curl:
```bash
curl -X POST https://your-app.vercel.app/api/webhooks/razorpay \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: <signature>" \
  -d '<event_payload>'
```

4. **Verify processing:**
```sql
SELECT * FROM webhook_events WHERE event_id = '<event_id>';
SELECT * FROM invoices WHERE razorpay_order_id = '<order_id>';
```
