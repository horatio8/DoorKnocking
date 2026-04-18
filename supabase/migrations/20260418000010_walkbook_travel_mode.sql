-- Walkbook travel mode: walking (default) or driving. Used to label duration
-- estimates correctly on the admin list and summary.

alter table public.walkbooks
  add column if not exists travel_mode text not null default 'walking';

do $$ begin
  alter table public.walkbooks
    add constraint walkbooks_travel_mode_check
    check (travel_mode in ('walking', 'driving'));
exception when duplicate_object then null; end $$;

-- Heuristic backfill: walkbooks whose bounding box diagonal exceeds ~1km
-- are more likely driving routes. Leaves everything at default='walking'
-- otherwise.
update public.walkbooks
  set travel_mode = 'driving'
  where travel_mode = 'walking'
    and bounding_box is not null
    and (
      -- crude approximation: corner-to-corner haversine > ~1 km in degrees
      abs((bounding_box->>'north')::numeric - (bounding_box->>'south')::numeric) > 0.01
      or abs((bounding_box->>'east')::numeric - (bounding_box->>'west')::numeric) > 0.01
    );
