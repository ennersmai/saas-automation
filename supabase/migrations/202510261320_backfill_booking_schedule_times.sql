-- Backfill check-in and check-out timestamps using Hostaway reservation metadata
with src as (
  select
    b.id,
    coalesce(p.timezone, 'UTC') as timezone_value,
    nullif(trim(b.metadata -> 'reservation' ->> 'arrivalDate'), '')::date as arrival_date,
    nullif(trim(b.metadata -> 'reservation' ->> 'departureDate'), '')::date as departure_date,
    coalesce(nullif(b.metadata -> 'reservation' ->> 'checkInTime', '')::double precision, 15.0) as raw_check_in_hour,
    coalesce(nullif(b.metadata -> 'reservation' ->> 'checkOutTime', '')::double precision, 10.0) as raw_check_out_hour
  from public.bookings b
  left join public.properties p on p.id = b.property_id
)
update public.bookings b
set
  check_in_at = coalesce(
    case
      when src.arrival_date is not null then
        (
          src.arrival_date::timestamp
          + make_interval(
              hours => calc.check_in_hour,
              mins => calc.check_in_minute
            )
        ) at time zone src.timezone_value
    end,
    b.check_in_at
  ),
  check_out_at = coalesce(
    case
      when src.departure_date is not null then
        (
          src.departure_date::timestamp
          + make_interval(
              hours => calc.check_out_hour,
              mins => calc.check_out_minute
            )
        ) at time zone src.timezone_value
    end,
    b.check_out_at
  ),
  updated_at = now()
from src
cross join lateral (
  select
    floor(least(23, greatest(0, src.raw_check_in_hour)))::int as check_in_hour,
    least(
      59,
      greatest(
        0,
        round(
          60 * (
            least(23, greatest(0, src.raw_check_in_hour))
            - floor(least(23, greatest(0, src.raw_check_in_hour)))
          )
        )
      )
    )::int as check_in_minute,
    floor(least(23, greatest(0, src.raw_check_out_hour)))::int as check_out_hour,
    least(
      59,
      greatest(
        0,
        round(
          60 * (
            least(23, greatest(0, src.raw_check_out_hour))
            - floor(least(23, greatest(0, src.raw_check_out_hour)))
          )
        )
      )
    )::int as check_out_minute
) calc
where b.id = src.id
  and (b.check_in_at is null or b.check_out_at is null);
