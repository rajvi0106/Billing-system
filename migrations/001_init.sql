create table if not exists customers(
    id SERIAL PRIMARY KEY ,
    name text NOT NULL ,
    price_per_event NUMERIC(10,4) NOT NULL DEFAULT 0.01,
    created_at timestamptz not null default now() 
);

create table if not exists usage_events(
    id serial primary key,
    event_id  text unique not null,
    customer_id integer not null references customers(id),
    event_type text not null,
    occured_at timestamptz not null,
    recived_at timestamptz not null default now(),
    created_type timestamptz not null default now()
);  
create index if not exists idx_usage_events_customer_period on usage_events(customer_id,occured_at);

create table if not exists invoices(
    id serial primary key,
    customer_id integer not null references customers(id),
    period_start timestamptz not null,
    period_end timestamptz not null,
    event_count integer not null,
    amount numeric(10,2) not null,
    generated_at timestamptz not null default now(),unique(customer_id,period_start,period_end)
);