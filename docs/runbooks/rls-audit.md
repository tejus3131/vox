# RLS Audit

## When to use
- After schema changes
- Security review
- New table added

## Steps

1. **Verify RLS is enabled on all org-scoped tables:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('data_sources', 'chat_sessions', 'data_source_access');
```
All should show `rowsecurity = true`.

2. **List all policies:**
```sql
SELECT tablename, policyname, permissive, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

3. **Test cross-org isolation:**
```sql
SET LOCAL app.user_id = '<user_from_org_a>';
SELECT * FROM data_sources WHERE org_id = '<org_b_id>';
-- Should return 0 rows
```

4. **Test member access:**
```sql
SET LOCAL app.user_id = '<member_user_id>';
-- Should only see data_sources they have access to
SELECT ds.* FROM data_sources ds
JOIN data_source_access dsa ON ds.id = dsa.data_source_id
WHERE dsa.user_id = current_setting('app.user_id');
```
