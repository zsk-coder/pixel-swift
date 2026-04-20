create or replace function public.handle_new_user_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_entitlements (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_init_entitlements on auth.users;

create trigger on_auth_user_created_init_entitlements
after insert on auth.users
for each row
execute function public.handle_new_user_entitlements();
