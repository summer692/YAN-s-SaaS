-- Atlas: allow permanent deletion only from Trash.
-- This keeps normal rows protected: DELETE works only when deleted_at is already set.

drop policy if exists "Users can permanently delete trashed projects" on public.projects;
create policy "Users can permanently delete trashed projects"
on public.projects
for delete
to authenticated
using (auth.uid() = user_id and deleted_at is not null);

drop policy if exists "Users can permanently delete trashed ideas" on public.ideas;
create policy "Users can permanently delete trashed ideas"
on public.ideas
for delete
to authenticated
using (auth.uid() = user_id and deleted_at is not null);
