create or replace function public.add_xp(target_user uuid, delta integer)
returns void
language plpgsql
security definer
as $function$
begin
  update public.profiles
  set
    xp_total = greatest(coalesce(xp_total, 0) + delta, 0),
    xp = greatest(coalesce(xp_total, 0) + delta, 0),
    level = (floor(greatest(coalesce(xp_total, 0) + delta, 0)::numeric / 100) + 1)::int
  where id = target_user;
end;
$function$;

update public.profiles
set
  xp_total = greatest(coalesce(xp_total, 0), coalesce(xp, 0)),
  xp = greatest(coalesce(xp_total, 0), coalesce(xp, 0)),
  level = (floor(greatest(coalesce(xp_total, 0), coalesce(xp, 0))::numeric / 100) + 1)::int
where coalesce(xp, 0) > coalesce(xp_total, 0);