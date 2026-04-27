-- Track the driving distance from the volunteer's GPS at generation time
-- to the closest voter on their route, so the walkbook landing screen
-- can surface "you're X min drive from the closest voters" when the
-- knocker is far from the cluster.

alter table public.walkbooks
  add column if not exists metres_to_closest int;
