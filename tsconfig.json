create index if not exists ai_providers_workspace_id_idx on public.ai_providers(workspace_id);
create index if not exists alert_events_rule_id_idx on public.alert_events(rule_id);
create index if not exists alert_events_workspace_id_idx on public.alert_events(workspace_id);
create index if not exists alert_rules_created_by_idx on public.alert_rules(created_by);
create index if not exists alert_rules_topic_id_idx on public.alert_rules(topic_id);
create index if not exists alert_rules_workspace_id_idx on public.alert_rules(workspace_id);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists audit_logs_workspace_id_idx on public.audit_logs(workspace_id);
create index if not exists conversation_analyses_workspace_id_idx on public.conversation_analyses(workspace_id);
create index if not exists conversation_entities_entity_id_idx on public.conversation_entities(entity_id);
create index if not exists monitoring_topics_created_by_idx on public.monitoring_topics(created_by);
create index if not exists monitoring_topics_workspace_id_idx on public.monitoring_topics(workspace_id);
create index if not exists narrative_conversations_conversation_id_idx on public.narrative_conversations(conversation_id);
create index if not exists narratives_workspace_id_idx on public.narratives(workspace_id);
create index if not exists propagation_edges_conversation_id_idx on public.propagation_edges(conversation_id);
create index if not exists propagation_edges_topic_id_idx on public.propagation_edges(topic_id);
create index if not exists propagation_edges_workspace_id_idx on public.propagation_edges(workspace_id);
create index if not exists reports_created_by_idx on public.reports(created_by);
create index if not exists reports_topic_id_idx on public.reports(topic_id);
create index if not exists reports_workspace_id_idx on public.reports(workspace_id);
create index if not exists topic_metrics_hourly_workspace_id_idx on public.topic_metrics_hourly(workspace_id);
create index if not exists worker_jobs_topic_id_idx on public.worker_jobs(topic_id);
create index if not exists worker_jobs_workspace_id_idx on public.worker_jobs(workspace_id);
create index if not exists workspace_memberships_user_id_idx on public.workspace_memberships(user_id);

drop policy topic_analyst_write on public.monitoring_topics;
create policy topic_analyst_insert on public.monitoring_topics for insert to authenticated with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=monitoring_topics.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy topic_analyst_update on public.monitoring_topics for update to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=monitoring_topics.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst'))) with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=monitoring_topics.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy topic_analyst_delete on public.monitoring_topics for delete to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=monitoring_topics.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));

drop policy connector_admin_write on public.connectors;
create policy connector_admin_insert on public.connectors for insert to authenticated with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=connectors.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy connector_admin_update on public.connectors for update to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=connectors.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=connectors.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy connector_admin_delete on public.connectors for delete to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=connectors.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy alert_rule_analyst_write on public.alert_rules;
create policy alert_rule_analyst_insert on public.alert_rules for insert to authenticated with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=alert_rules.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy alert_rule_analyst_update on public.alert_rules for update to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=alert_rules.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst'))) with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=alert_rules.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy alert_rule_analyst_delete on public.alert_rules for delete to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=alert_rules.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
