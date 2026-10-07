create policy connector_credentials_service_role_only
on public.connector_credentials
for all to service_role
using (true)
with check (true);
