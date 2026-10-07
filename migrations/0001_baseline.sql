-- Baseline schema for Ledgerline.
--
-- One file that creates every table, sequence, index, constraint and view the
-- app uses, on an empty database. Generated with pg_dump --schema-only.
-- Later schema changes go in new numbered files after this one.

CREATE TABLE public.accounts (
    id bigint NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE SEQUENCE public.accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;

CREATE TABLE public.alert_runs (
    data_date date NOT NULL,
    status text NOT NULL,
    trigger text NOT NULL,
    opened integer,
    closed integer,
    suppressed jsonb,
    error text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    emailed_at timestamp with time zone,
    email_result jsonb,
    CONSTRAINT alert_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text])))
);

CREATE TABLE public.alerts (
    id bigint NOT NULL,
    rule text NOT NULL,
    severity text NOT NULL,
    dedupe_key text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    data_date date NOT NULL,
    client_id bigint,
    api_code text,
    vendor text,
    title text NOT NULL,
    body text,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    closed_data_date date,
    acknowledged_at timestamp with time zone,
    acknowledged_by bigint,
    snoozed_until date,
    close_reason text,
    snoozed_by bigint,
    emailed_at timestamp with time zone,
    email_result jsonb,
    CONSTRAINT alerts_close_reason_check CHECK ((close_reason = ANY (ARRAY['recovered'::text, 'acknowledged'::text, 'expired'::text]))),
    CONSTRAINT alerts_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'info'::text]))),
    CONSTRAINT alerts_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);

CREATE SEQUENCE public.alerts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;

CREATE TABLE public.api_bundle_members (
    bundle_id bigint NOT NULL,
    client_id bigint NOT NULL,
    api_code text NOT NULL
);

CREATE TABLE public.api_bundles (
    id bigint NOT NULL,
    client_id bigint NOT NULL,
    name text NOT NULL,
    anchor_api_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.api_bundles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.api_bundles_id_seq OWNED BY public.api_bundles.id;

CREATE TABLE public.api_code_overrides (
    raw_api_name text NOT NULL,
    api_code text NOT NULL,
    note text,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.apis (
    product_code text NOT NULL,
    name text NOT NULL,
    log_aliases text DEFAULT '[]'::text NOT NULL,
    category text,
    entity_type text,
    vendor_type text,
    default_vendor text,
    is_active integer DEFAULT 1 NOT NULL
);

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text
);

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    before_json text,
    after_json text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;

CREATE TABLE public.billing_periods (
    id bigint NOT NULL,
    label text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    closed_at timestamp with time zone,
    closed_by bigint,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT billing_periods_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);

CREATE SEQUENCE public.billing_periods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.billing_periods_id_seq OWNED BY public.billing_periods.id;

CREATE TABLE public.bundle_pricing (
    id bigint NOT NULL,
    bundle_id bigint NOT NULL,
    price_successful numeric(14,4) DEFAULT 0 NOT NULL,
    price_successful_no_data numeric(14,4) DEFAULT 0 NOT NULL,
    price_failed numeric(14,4) DEFAULT 0 NOT NULL,
    price_in_progress numeric(14,4) DEFAULT 0 NOT NULL,
    effective_from date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.bundle_pricing_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.bundle_pricing_id_seq OWNED BY public.bundle_pricing.id;

CREATE TABLE public.client_operations (
    id bigint NOT NULL,
    kind text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    source_client_id bigint NOT NULL,
    target_client_id bigint,
    requested_by bigint NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_by bigint,
    decided_at timestamp with time zone,
    executed_at timestamp with time zone,
    reversed_at timestamp with time zone,
    reverse_deadline timestamp with time zone,
    note text,
    payload jsonb,
    CONSTRAINT client_operations_kind_check CHECK ((kind = ANY (ARRAY['merge'::text, 'delete'::text]))),
    CONSTRAINT client_operations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'rejected'::text, 'executed'::text, 'reversed'::text, 'purged'::text])))
);

CREATE SEQUENCE public.client_operations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.client_operations_id_seq OWNED BY public.client_operations.id;

CREATE TABLE public.client_slugs (
    slug text NOT NULL,
    client_id bigint NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.clients (
    id bigint NOT NULL,
    account_id bigint,
    display_name text NOT NULL,
    slug text,
    log_aliases text DEFAULT '[]'::text NOT NULL,
    billing_entity text,
    gstin text,
    client_code text,
    website text,
    cs_owner text,
    sales_owner text,
    logo_data_url text,
    msa_url text,
    msa_start_date date,
    msa_end_date date,
    status text DEFAULT 'active'::text NOT NULL,
    is_sandbox integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by bigint,
    deleted_reason text,
    merged_into bigint,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT clients_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'sandbox'::text])))
);

CREATE SEQUENCE public.clients_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;

CREATE TABLE public.invoice_sequence (
    year integer NOT NULL,
    last_seq integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.leak_dismissals (
    id bigint NOT NULL,
    client_id bigint NOT NULL,
    api_code text NOT NULL,
    dismissed_by bigint,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.leak_dismissals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.leak_dismissals_id_seq OWNED BY public.leak_dismissals.id;

CREATE TABLE public.manual_entries (
    id bigint NOT NULL,
    client_id bigint NOT NULL,
    effective_date date NOT NULL,
    reason text NOT NULL,
    reference text,
    attachment_path text,
    source text DEFAULT 'manual'::text NOT NULL,
    import_hash text,
    status text DEFAULT 'draft'::text NOT NULL,
    total_revenue numeric(14,4) DEFAULT 0 NOT NULL,
    created_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_by bigint,
    approved_at timestamp with time zone,
    voided_by bigint,
    voided_at timestamp with time zone,
    void_reason text,
    CONSTRAINT manual_entries_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'import'::text]))),
    CONSTRAINT manual_entries_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text, 'void'::text])))
);

CREATE SEQUENCE public.manual_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.manual_entries_id_seq OWNED BY public.manual_entries.id;

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    entity_type text,
    entity_id text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;

CREATE TABLE public.pricing (
    id bigint NOT NULL,
    client_id bigint NOT NULL,
    api_code text NOT NULL,
    price_successful numeric(14,4) DEFAULT 0 NOT NULL,
    price_successful_no_data numeric(14,4) DEFAULT 0 NOT NULL,
    price_failed numeric(14,4) DEFAULT 0 NOT NULL,
    price_in_progress numeric(14,4) DEFAULT 0 NOT NULL,
    effective_from date DEFAULT '2026-01-01'::date NOT NULL,
    pricing_model text DEFAULT 'flat'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT pricing_pricing_model_check CHECK ((pricing_model = ANY (ARRAY['flat'::text, 'slab'::text, 'tier'::text])))
);

CREATE SEQUENCE public.pricing_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.pricing_id_seq OWNED BY public.pricing.id;

CREATE TABLE public.pricing_slab (
    id bigint NOT NULL,
    pricing_id bigint NOT NULL,
    min_hits integer NOT NULL,
    max_hits integer,
    price_successful numeric(14,4) DEFAULT 0 NOT NULL,
    price_successful_no_data numeric(14,4) DEFAULT 0 NOT NULL,
    price_failed numeric(14,4) DEFAULT 0 NOT NULL,
    price_in_progress numeric(14,4) DEFAULT 0 NOT NULL,
    CONSTRAINT pricing_slab_bounds CHECK (((max_hits IS NULL) OR (max_hits > min_hits)))
);

CREATE SEQUENCE public.pricing_slab_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.pricing_slab_id_seq OWNED BY public.pricing_slab.id;

CREATE TABLE public.sandbox_billing_rules (
    id integer NOT NULL,
    client_id integer NOT NULL,
    api_code text,
    effective_from date DEFAULT '2026-04-01'::date NOT NULL,
    billable_hits integer,
    note text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sandbox_billing_rules_hits_nonneg CHECK (((billable_hits IS NULL) OR (billable_hits >= 0)))
);

CREATE SEQUENCE public.sandbox_billing_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.sandbox_billing_rules_id_seq OWNED BY public.sandbox_billing_rules.id;

CREATE TABLE public.sandbox_classifications (
    id bigint NOT NULL,
    client_id bigint NOT NULL,
    api_code text NOT NULL,
    effective_from date NOT NULL,
    is_sandbox integer NOT NULL,
    note text,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sandbox_classifications_is_sandbox_check CHECK ((is_sandbox = ANY (ARRAY[0, 1])))
);

CREATE SEQUENCE public.sandbox_classifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.sandbox_classifications_id_seq OWNED BY public.sandbox_classifications.id;

CREATE TABLE public.statement_adjustments (
    id bigint NOT NULL,
    statement_id bigint NOT NULL,
    label text NOT NULL,
    amount numeric(14,4) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by bigint NOT NULL
);

CREATE SEQUENCE public.statement_adjustments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.statement_adjustments_id_seq OWNED BY public.statement_adjustments.id;

CREATE TABLE public.statement_lines (
    id bigint NOT NULL,
    statement_id bigint NOT NULL,
    api_code text NOT NULL,
    api_name text NOT NULL,
    successful bigint DEFAULT 0 NOT NULL,
    successful_no_data bigint DEFAULT 0 NOT NULL,
    failed bigint DEFAULT 0 NOT NULL,
    in_progress bigint DEFAULT 0 NOT NULL,
    price_successful numeric(14,4) DEFAULT 0 NOT NULL,
    price_successful_no_data numeric(14,4) DEFAULT 0 NOT NULL,
    price_failed numeric(14,4) DEFAULT 0 NOT NULL,
    price_in_progress numeric(14,4) DEFAULT 0 NOT NULL,
    vendor_cost numeric(14,4) DEFAULT 0 NOT NULL,
    revenue numeric(14,4) DEFAULT 0 NOT NULL,
    margin numeric(14,4) DEFAULT 0 NOT NULL,
    is_bundle integer DEFAULT 0 NOT NULL,
    vendor_estimated boolean DEFAULT false NOT NULL
);

CREATE SEQUENCE public.statement_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.statement_lines_id_seq OWNED BY public.statement_lines.id;

CREATE TABLE public.statements (
    id bigint NOT NULL,
    client_id bigint NOT NULL,
    period_id bigint NOT NULL,
    number text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    total_revenue numeric(14,4) DEFAULT 0 NOT NULL,
    total_vendor_cost numeric(14,4) DEFAULT 0 NOT NULL,
    total_margin numeric(14,4) DEFAULT 0 NOT NULL,
    total_hits bigint DEFAULT 0 NOT NULL,
    generated_at timestamp with time zone,
    generated_by bigint,
    issued_at timestamp with time zone,
    issued_by bigint,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    cost_hits integer,
    cost_contracted integer,
    cost_quoted integer,
    cost_estimated integer,
    cost_not_billed integer,
    cost_unknown integer,
    CONSTRAINT statements_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'final'::text, 'issued'::text])))
);

CREATE SEQUENCE public.statements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.statements_id_seq OWNED BY public.statements.id;

CREATE TABLE public.sync_runs (
    id bigint NOT NULL,
    trigger text NOT NULL,
    target_date date NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    rows_fetched integer,
    rows_inserted integer,
    rows_deleted integer,
    unmapped_clients integer,
    unmapped_apis integer,
    total_hits bigint,
    error text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT sync_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text]))),
    CONSTRAINT sync_runs_trigger_check CHECK ((trigger = ANY (ARRAY['cron'::text, 'manual'::text, 'backfill'::text])))
);

CREATE SEQUENCE public.sync_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.sync_runs_id_seq OWNED BY public.sync_runs.id;

CREATE TABLE public.usage_daily (
    id bigint NOT NULL,
    date date NOT NULL,
    client_id bigint,
    api_code text,
    raw_client_name text NOT NULL,
    raw_api_name text NOT NULL,
    hits_via text,
    vendor text,
    failed integer DEFAULT 0 NOT NULL,
    in_progress integer DEFAULT 0 NOT NULL,
    successful_no_data integer DEFAULT 0 NOT NULL,
    successful integer DEFAULT 0 NOT NULL,
    source text DEFAULT 'log'::text NOT NULL,
    manual_entry_id bigint,
    raw_api_code text,
    vendor_id bigint,
    CONSTRAINT usage_daily_source_check CHECK ((source = ANY (ARRAY['log'::text, 'manual'::text, 'import'::text])))
);

CREATE SEQUENCE public.usage_daily_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.usage_daily_id_seq OWNED BY public.usage_daily.id;

CREATE TABLE public.vendor_pricing (
    id bigint NOT NULL,
    api_code text NOT NULL,
    cost_successful numeric(14,4),
    cost_successful_no_data numeric(14,4),
    cost_failed numeric(14,4),
    cost_in_progress numeric(14,4),
    effective_from date DEFAULT '2026-01-01'::date NOT NULL,
    status text DEFAULT 'estimated'::text NOT NULL,
    source text,
    cost_basis text DEFAULT 'vendor'::text NOT NULL,
    pricing_model text DEFAULT 'flat'::text NOT NULL,
    vendor_id bigint NOT NULL,
    CONSTRAINT vendor_pricing_cost_basis_check CHECK ((cost_basis = ANY (ARRAY['vendor'::text, 'in_house'::text, 'components'::text]))),
    CONSTRAINT vendor_pricing_pricing_model_check CHECK ((pricing_model = ANY (ARRAY['flat'::text, 'slab'::text, 'tier'::text]))),
    CONSTRAINT vendor_pricing_status_check CHECK ((status = ANY (ARRAY['estimated'::text, 'quoted'::text, 'contracted'::text])))
);

CREATE TABLE public.vendors (
    id bigint NOT NULL,
    canonical_name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    charges_sandbox boolean DEFAULT true NOT NULL,
    CONSTRAINT vendors_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);

CREATE VIEW public.usage_daily_with_revenue AS
 SELECT usage_id,
    date,
    client_id,
    account_id,
    client_name,
    is_sandbox,
    effective_is_sandbox,
    api_code,
    api_name,
    hits_via,
    vendor_id,
    vendor,
    vendor_billable,
    raw_vendor,
    successful,
    successful_no_data,
    failed,
    in_progress,
    raw_client_name,
    raw_api_name,
    source,
    manual_entry_id,
    bundle_id,
    bundle_name,
    bundle_anchor,
    bundle_applied,
    p_model,
    p_s,
    p_snd,
    p_f,
    p_ip,
    c_s,
    c_snd,
    c_f,
    c_ip,
    vendor_cost_status,
    vendor_cost_basis,
    vendor_cost_model,
    vendor_cost_known,
    (((((successful)::numeric * p_s) + ((successful_no_data)::numeric * p_snd)) + ((failed)::numeric * p_f)) + ((in_progress)::numeric * p_ip)) AS revenue,
    (((((successful)::numeric * c_s) + ((successful_no_data)::numeric * c_snd)) + ((failed)::numeric * c_f)) + ((in_progress)::numeric * c_ip)) AS vendor_cost
   FROM ( SELECT u.id AS usage_id,
            u.date,
            u.client_id,
            c.account_id,
            c.display_name AS client_name,
            c.is_sandbox,
            COALESCE(scr.is_sandbox, c.is_sandbox) AS effective_is_sandbox,
            u.api_code,
            a.name AS api_name,
            u.hits_via,
            u.vendor_id,
            COALESCE(vend.canonical_name, u.vendor) AS vendor,
            (COALESCE(vend.charges_sandbox, true) OR (COALESCE(scr.is_sandbox, c.is_sandbox) = 0)) AS vendor_billable,
            u.vendor AS raw_vendor,
            u.successful,
            u.successful_no_data,
            u.failed,
            u.in_progress,
            u.raw_client_name,
            u.raw_api_name,
            u.source,
            u.manual_entry_id,
            bm.bundle_id,
            b.name AS bundle_name,
                CASE
                    WHEN ((bm.bundle_id IS NOT NULL) AND (b.anchor_api_code = u.api_code)) THEN 1
                    ELSE 0
                END AS bundle_anchor,
                CASE
                    WHEN (bp.id IS NOT NULL) THEN 1
                    ELSE 0
                END AS bundle_applied,
            COALESCE(p.pricing_model, 'flat'::text) AS p_model,
                CASE
                    WHEN (bp.id IS NOT NULL) THEN
                    CASE
                        WHEN (b.anchor_api_code = u.api_code) THEN COALESCE(bp.price_successful, (0)::numeric)
                        ELSE (0)::numeric
                    END
                    ELSE COALESCE(p.price_successful, (0)::numeric)
                END AS p_s,
                CASE
                    WHEN (bp.id IS NOT NULL) THEN
                    CASE
                        WHEN (b.anchor_api_code = u.api_code) THEN COALESCE(bp.price_successful_no_data, (0)::numeric)
                        ELSE (0)::numeric
                    END
                    ELSE COALESCE(p.price_successful_no_data, (0)::numeric)
                END AS p_snd,
                CASE
                    WHEN (bp.id IS NOT NULL) THEN
                    CASE
                        WHEN (b.anchor_api_code = u.api_code) THEN COALESCE(bp.price_failed, (0)::numeric)
                        ELSE (0)::numeric
                    END
                    ELSE COALESCE(p.price_failed, (0)::numeric)
                END AS p_f,
                CASE
                    WHEN (bp.id IS NOT NULL) THEN
                    CASE
                        WHEN (b.anchor_api_code = u.api_code) THEN COALESCE(bp.price_in_progress, (0)::numeric)
                        ELSE (0)::numeric
                    END
                    ELSE COALESCE(p.price_in_progress, (0)::numeric)
                END AS p_ip,
                CASE
                    WHEN ((COALESCE(vp.cost_basis, 'vendor'::text) <> 'vendor'::text) OR ((COALESCE(scr.is_sandbox, c.is_sandbox) = 1) AND (NOT COALESCE(vend.charges_sandbox, true)))) THEN (0)::numeric
                    ELSE COALESCE(vp.cost_successful, (0)::numeric)
                END AS c_s,
                CASE
                    WHEN ((COALESCE(vp.cost_basis, 'vendor'::text) <> 'vendor'::text) OR ((COALESCE(scr.is_sandbox, c.is_sandbox) = 1) AND (NOT COALESCE(vend.charges_sandbox, true)))) THEN (0)::numeric
                    ELSE COALESCE(vp.cost_successful_no_data, (0)::numeric)
                END AS c_snd,
                CASE
                    WHEN ((COALESCE(vp.cost_basis, 'vendor'::text) <> 'vendor'::text) OR ((COALESCE(scr.is_sandbox, c.is_sandbox) = 1) AND (NOT COALESCE(vend.charges_sandbox, true)))) THEN (0)::numeric
                    ELSE COALESCE(vp.cost_failed, (0)::numeric)
                END AS c_f,
                CASE
                    WHEN ((COALESCE(vp.cost_basis, 'vendor'::text) <> 'vendor'::text) OR ((COALESCE(scr.is_sandbox, c.is_sandbox) = 1) AND (NOT COALESCE(vend.charges_sandbox, true)))) THEN (0)::numeric
                    ELSE COALESCE(vp.cost_in_progress, (0)::numeric)
                END AS c_ip,
            vp.status AS vendor_cost_status,
            vp.cost_basis AS vendor_cost_basis,
            COALESCE(vp.pricing_model, 'flat'::text) AS vendor_cost_model,
            ((vp.cost_successful IS NOT NULL) OR (COALESCE(vp.pricing_model, 'flat'::text) <> 'flat'::text) OR (COALESCE(vp.cost_basis, 'vendor'::text) <> 'vendor'::text) OR ((COALESCE(scr.is_sandbox, c.is_sandbox) = 1) AND (NOT COALESCE(vend.charges_sandbox, true)))) AS vendor_cost_known
           FROM ((((((((((public.usage_daily u
             LEFT JOIN public.clients c ON ((c.id = u.client_id)))
             LEFT JOIN public.apis a ON ((a.product_code = u.api_code)))
             LEFT JOIN public.vendors vend ON ((vend.id = u.vendor_id)))
             LEFT JOIN public.manual_entries me ON ((me.id = u.manual_entry_id)))
             LEFT JOIN public.api_bundle_members bm ON (((bm.client_id = u.client_id) AND (bm.api_code = u.api_code))))
             LEFT JOIN public.api_bundles b ON ((b.id = bm.bundle_id)))
             LEFT JOIN LATERAL ( SELECT bp2.id,
                    bp2.bundle_id,
                    bp2.price_successful,
                    bp2.price_successful_no_data,
                    bp2.price_failed,
                    bp2.price_in_progress,
                    bp2.effective_from,
                    bp2.created_at
                   FROM public.bundle_pricing bp2
                  WHERE ((bp2.bundle_id = bm.bundle_id) AND (bp2.effective_from <= u.date))
                  ORDER BY bp2.effective_from DESC
                 LIMIT 1) bp ON (true))
             LEFT JOIN LATERAL ( SELECT p2.id,
                    p2.client_id,
                    p2.api_code,
                    p2.price_successful,
                    p2.price_successful_no_data,
                    p2.price_failed,
                    p2.price_in_progress,
                    p2.effective_from,
                    p2.pricing_model,
                    p2.created_at
                   FROM public.pricing p2
                  WHERE ((p2.client_id = u.client_id) AND (p2.api_code = u.api_code) AND (p2.effective_from <= u.date))
                  ORDER BY p2.effective_from DESC
                 LIMIT 1) p ON (true))
             LEFT JOIN LATERAL ( SELECT vp2.id,
                    vp2.api_code,
                    vp2.cost_successful,
                    vp2.cost_successful_no_data,
                    vp2.cost_failed,
                    vp2.cost_in_progress,
                    vp2.effective_from,
                    vp2.status,
                    vp2.source,
                    vp2.cost_basis,
                    vp2.pricing_model,
                    vp2.vendor_id
                   FROM public.vendor_pricing vp2
                  WHERE ((vp2.vendor_id = u.vendor_id) AND (vp2.api_code = u.api_code) AND (vp2.effective_from <= u.date))
                  ORDER BY vp2.effective_from DESC
                 LIMIT 1) vp ON (true))
             LEFT JOIN LATERAL ( SELECT scr2.is_sandbox
                   FROM public.sandbox_classifications scr2
                  WHERE ((scr2.client_id = u.client_id) AND (scr2.api_code = u.api_code) AND (scr2.effective_from <= u.date))
                  ORDER BY scr2.effective_from DESC
                 LIMIT 1) scr ON (true))
          WHERE ((u.manual_entry_id IS NULL) OR (me.status = 'approved'::text))) base;

CREATE TABLE public.users (
    id bigint NOT NULL,
    email text NOT NULL,
    google_sub text,
    display_name text NOT NULL,
    role text NOT NULL,
    status text DEFAULT 'invited'::text NOT NULL,
    invited_by bigint,
    created_at timestamp with time zone DEFAULT now(),
    last_login_at timestamp with time zone,
    invite_expires_at timestamp with time zone,
    emoji text,
    job_title text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'editor'::text, 'member'::text]))),
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'invited'::text, 'disabled'::text])))
);

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

CREATE TABLE public.vendor_aliases (
    id bigint NOT NULL,
    vendor_id bigint NOT NULL,
    alias text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.vendor_aliases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.vendor_aliases_id_seq OWNED BY public.vendor_aliases.id;

CREATE TABLE public.vendor_commitments (
    id bigint NOT NULL,
    effective_from date NOT NULL,
    monthly_minimum numeric(14,4),
    status text DEFAULT 'estimated'::text NOT NULL,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    vendor_id bigint NOT NULL,
    CONSTRAINT vendor_commitments_status_check CHECK ((status = ANY (ARRAY['estimated'::text, 'quoted'::text, 'contracted'::text])))
);

CREATE SEQUENCE public.vendor_commitments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.vendor_commitments_id_seq OWNED BY public.vendor_commitments.id;

CREATE SEQUENCE public.vendor_pricing_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.vendor_pricing_id_seq OWNED BY public.vendor_pricing.id;

CREATE TABLE public.vendor_pricing_slab (
    id bigint NOT NULL,
    vendor_pricing_id bigint NOT NULL,
    min_hits integer NOT NULL,
    max_hits integer,
    cost_successful numeric(14,4),
    cost_successful_no_data numeric(14,4),
    cost_failed numeric(14,4),
    cost_in_progress numeric(14,4),
    CONSTRAINT vendor_pricing_slab_bounds CHECK (((max_hits IS NULL) OR (max_hits > min_hits)))
);

CREATE SEQUENCE public.vendor_pricing_slab_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.vendor_pricing_slab_id_seq OWNED BY public.vendor_pricing_slab.id;

CREATE TABLE public.vendor_recon_dismissals (
    id bigint NOT NULL,
    vendor text NOT NULL,
    api_code text,
    raw_api_name text,
    period_month date NOT NULL,
    dismissed_by bigint,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.vendor_recon_dismissals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.vendor_recon_dismissals_id_seq OWNED BY public.vendor_recon_dismissals.id;

CREATE TABLE public.vendor_usage_daily (
    id bigint NOT NULL,
    date date NOT NULL,
    vendor text NOT NULL,
    api_code text,
    raw_api_name text NOT NULL,
    raw_api_slug text NOT NULL,
    successful bigint DEFAULT 0 NOT NULL,
    successful_no_data bigint DEFAULT 0 NOT NULL,
    failed bigint DEFAULT 0 NOT NULL,
    synced_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.vendor_usage_daily_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.vendor_usage_daily_id_seq OWNED BY public.vendor_usage_daily.id;

CREATE SEQUENCE public.vendors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.vendors_id_seq OWNED BY public.vendors.id;

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);

ALTER TABLE ONLY public.api_bundles ALTER COLUMN id SET DEFAULT nextval('public.api_bundles_id_seq'::regclass);

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);

ALTER TABLE ONLY public.billing_periods ALTER COLUMN id SET DEFAULT nextval('public.billing_periods_id_seq'::regclass);

ALTER TABLE ONLY public.bundle_pricing ALTER COLUMN id SET DEFAULT nextval('public.bundle_pricing_id_seq'::regclass);

ALTER TABLE ONLY public.client_operations ALTER COLUMN id SET DEFAULT nextval('public.client_operations_id_seq'::regclass);

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);

ALTER TABLE ONLY public.leak_dismissals ALTER COLUMN id SET DEFAULT nextval('public.leak_dismissals_id_seq'::regclass);

ALTER TABLE ONLY public.manual_entries ALTER COLUMN id SET DEFAULT nextval('public.manual_entries_id_seq'::regclass);

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);

ALTER TABLE ONLY public.pricing ALTER COLUMN id SET DEFAULT nextval('public.pricing_id_seq'::regclass);

ALTER TABLE ONLY public.pricing_slab ALTER COLUMN id SET DEFAULT nextval('public.pricing_slab_id_seq'::regclass);

ALTER TABLE ONLY public.sandbox_billing_rules ALTER COLUMN id SET DEFAULT nextval('public.sandbox_billing_rules_id_seq'::regclass);

ALTER TABLE ONLY public.sandbox_classifications ALTER COLUMN id SET DEFAULT nextval('public.sandbox_classifications_id_seq'::regclass);

ALTER TABLE ONLY public.statement_adjustments ALTER COLUMN id SET DEFAULT nextval('public.statement_adjustments_id_seq'::regclass);

ALTER TABLE ONLY public.statement_lines ALTER COLUMN id SET DEFAULT nextval('public.statement_lines_id_seq'::regclass);

ALTER TABLE ONLY public.statements ALTER COLUMN id SET DEFAULT nextval('public.statements_id_seq'::regclass);

ALTER TABLE ONLY public.sync_runs ALTER COLUMN id SET DEFAULT nextval('public.sync_runs_id_seq'::regclass);

ALTER TABLE ONLY public.usage_daily ALTER COLUMN id SET DEFAULT nextval('public.usage_daily_id_seq'::regclass);

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE ONLY public.vendor_aliases ALTER COLUMN id SET DEFAULT nextval('public.vendor_aliases_id_seq'::regclass);

ALTER TABLE ONLY public.vendor_commitments ALTER COLUMN id SET DEFAULT nextval('public.vendor_commitments_id_seq'::regclass);

ALTER TABLE ONLY public.vendor_pricing ALTER COLUMN id SET DEFAULT nextval('public.vendor_pricing_id_seq'::regclass);

ALTER TABLE ONLY public.vendor_pricing_slab ALTER COLUMN id SET DEFAULT nextval('public.vendor_pricing_slab_id_seq'::regclass);

ALTER TABLE ONLY public.vendor_recon_dismissals ALTER COLUMN id SET DEFAULT nextval('public.vendor_recon_dismissals_id_seq'::regclass);

ALTER TABLE ONLY public.vendor_usage_daily ALTER COLUMN id SET DEFAULT nextval('public.vendor_usage_daily_id_seq'::regclass);

ALTER TABLE ONLY public.vendors ALTER COLUMN id SET DEFAULT nextval('public.vendors_id_seq'::regclass);

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_name_key UNIQUE (name);

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.alert_runs
    ADD CONSTRAINT alert_runs_pkey PRIMARY KEY (data_date);

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.api_bundle_members
    ADD CONSTRAINT api_bundle_members_client_id_api_code_key UNIQUE (client_id, api_code);

ALTER TABLE ONLY public.api_bundle_members
    ADD CONSTRAINT api_bundle_members_pkey PRIMARY KEY (bundle_id, api_code);

ALTER TABLE ONLY public.api_bundles
    ADD CONSTRAINT api_bundles_client_id_name_key UNIQUE (client_id, name);

ALTER TABLE ONLY public.api_bundles
    ADD CONSTRAINT api_bundles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.api_code_overrides
    ADD CONSTRAINT api_code_overrides_pkey PRIMARY KEY (raw_api_name);

ALTER TABLE ONLY public.apis
    ADD CONSTRAINT apis_pkey PRIMARY KEY (product_code);

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.billing_periods
    ADD CONSTRAINT billing_periods_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.billing_periods
    ADD CONSTRAINT billing_periods_start_date_end_date_key UNIQUE (start_date, end_date);

ALTER TABLE ONLY public.bundle_pricing
    ADD CONSTRAINT bundle_pricing_bundle_id_effective_from_key UNIQUE (bundle_id, effective_from);

ALTER TABLE ONLY public.bundle_pricing
    ADD CONSTRAINT bundle_pricing_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_operations
    ADD CONSTRAINT client_operations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_slugs
    ADD CONSTRAINT client_slugs_pkey PRIMARY KEY (slug);

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_display_name_key UNIQUE (display_name);

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.invoice_sequence
    ADD CONSTRAINT invoice_sequence_pkey PRIMARY KEY (year);

ALTER TABLE ONLY public.leak_dismissals
    ADD CONSTRAINT leak_dismissals_client_id_api_code_key UNIQUE (client_id, api_code);

ALTER TABLE ONLY public.leak_dismissals
    ADD CONSTRAINT leak_dismissals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.manual_entries
    ADD CONSTRAINT manual_entries_import_hash_key UNIQUE (import_hash);

ALTER TABLE ONLY public.manual_entries
    ADD CONSTRAINT manual_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pricing
    ADD CONSTRAINT pricing_client_id_api_code_effective_from_key UNIQUE (client_id, api_code, effective_from);

ALTER TABLE ONLY public.pricing
    ADD CONSTRAINT pricing_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pricing_slab
    ADD CONSTRAINT pricing_slab_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pricing_slab
    ADD CONSTRAINT pricing_slab_pricing_id_min_hits_key UNIQUE (pricing_id, min_hits);

ALTER TABLE ONLY public.sandbox_billing_rules
    ADD CONSTRAINT sandbox_billing_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sandbox_classifications
    ADD CONSTRAINT sandbox_classifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.statement_adjustments
    ADD CONSTRAINT statement_adjustments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.statement_lines
    ADD CONSTRAINT statement_lines_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.statements
    ADD CONSTRAINT statements_client_id_period_id_key UNIQUE (client_id, period_id);

ALTER TABLE ONLY public.statements
    ADD CONSTRAINT statements_number_key UNIQUE (number);

ALTER TABLE ONLY public.statements
    ADD CONSTRAINT statements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sync_runs
    ADD CONSTRAINT sync_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.usage_daily
    ADD CONSTRAINT usage_daily_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_sub_key UNIQUE (google_sub);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vendor_aliases
    ADD CONSTRAINT vendor_aliases_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vendor_commitments
    ADD CONSTRAINT vendor_commitments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vendor_commitments
    ADD CONSTRAINT vendor_commitments_vendor_date_key UNIQUE (vendor_id, effective_from);

ALTER TABLE ONLY public.vendor_pricing
    ADD CONSTRAINT vendor_pricing_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vendor_pricing_slab
    ADD CONSTRAINT vendor_pricing_slab_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vendor_pricing_slab
    ADD CONSTRAINT vendor_pricing_slab_vendor_pricing_id_min_hits_key UNIQUE (vendor_pricing_id, min_hits);

ALTER TABLE ONLY public.vendor_pricing
    ADD CONSTRAINT vendor_pricing_vendor_api_date_key UNIQUE (vendor_id, api_code, effective_from);

ALTER TABLE ONLY public.vendor_recon_dismissals
    ADD CONSTRAINT vendor_recon_dismissals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vendor_usage_daily
    ADD CONSTRAINT vendor_usage_daily_date_vendor_raw_api_name_raw_api_slug_key UNIQUE (date, vendor, raw_api_name, raw_api_slug);

ALTER TABLE ONLY public.vendor_usage_daily
    ADD CONSTRAINT vendor_usage_daily_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);

CREATE INDEX client_slugs_client_id_idx ON public.client_slugs USING btree (client_id);

CREATE UNIQUE INDEX clients_client_code_key ON public.clients USING btree (client_code) WHERE (client_code IS NOT NULL);

CREATE INDEX idx_alerts_client ON public.alerts USING btree (client_id, opened_at DESC);

CREATE INDEX idx_alerts_key ON public.alerts USING btree (dedupe_key);

CREATE INDEX idx_alerts_status ON public.alerts USING btree (status, severity, opened_at DESC);

CREATE INDEX idx_audit_entity ON public.audit_log USING btree (entity_type, entity_id);

CREATE INDEX idx_audit_user ON public.audit_log USING btree (user_id, created_at);

CREATE INDEX idx_bundle_members_client ON public.api_bundle_members USING btree (client_id, api_code);

CREATE INDEX idx_bundle_pricing_pair_date ON public.bundle_pricing USING btree (bundle_id, effective_from);

CREATE INDEX idx_client_ops_deadline ON public.client_operations USING btree (reverse_deadline) WHERE (status = 'executed'::text);

CREATE INDEX idx_client_ops_source ON public.client_operations USING btree (source_client_id);

CREATE INDEX idx_client_ops_status ON public.client_operations USING btree (status);

CREATE INDEX idx_clients_account ON public.clients USING btree (account_id);

CREATE INDEX idx_clients_deleted_at ON public.clients USING btree (deleted_at);

CREATE INDEX idx_leak_dismissals_pair ON public.leak_dismissals USING btree (client_id, api_code);

CREATE INDEX idx_manual_entries_client ON public.manual_entries USING btree (client_id);

CREATE INDEX idx_manual_entries_date ON public.manual_entries USING btree (effective_date);

CREATE INDEX idx_manual_entries_status ON public.manual_entries USING btree (status);

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, read_at, created_at DESC);

CREATE INDEX idx_pricing_api ON public.pricing USING btree (api_code);

CREATE INDEX idx_pricing_client ON public.pricing USING btree (client_id);

CREATE INDEX idx_pricing_pair_date ON public.pricing USING btree (client_id, api_code, effective_from);

CREATE INDEX idx_pricing_slab_pricing ON public.pricing_slab USING btree (pricing_id);

CREATE INDEX idx_sandbox_class_pair_date ON public.sandbox_classifications USING btree (client_id, api_code, effective_from);

CREATE INDEX idx_statement_adjustments_statement ON public.statement_adjustments USING btree (statement_id);

CREATE INDEX idx_statement_lines_pair ON public.statement_lines USING btree (statement_id, api_code);

CREATE INDEX idx_statement_lines_statement ON public.statement_lines USING btree (statement_id);

CREATE INDEX idx_statements_client ON public.statements USING btree (client_id);

CREATE INDEX idx_statements_period ON public.statements USING btree (period_id);

CREATE INDEX idx_statements_status ON public.statements USING btree (client_id, status);

CREATE INDEX idx_sync_runs_date ON public.sync_runs USING btree (target_date, started_at DESC);

CREATE INDEX idx_usage_api ON public.usage_daily USING btree (api_code);

CREATE INDEX idx_usage_client ON public.usage_daily USING btree (client_id);

CREATE INDEX idx_usage_date ON public.usage_daily USING btree (date);

CREATE INDEX idx_usage_date_api ON public.usage_daily USING btree (date, api_code);

CREATE INDEX idx_usage_date_client ON public.usage_daily USING btree (date, client_id);

CREATE INDEX idx_usage_manual_entry ON public.usage_daily USING btree (manual_entry_id);

CREATE INDEX idx_usage_vendor_id ON public.usage_daily USING btree (vendor_id);

CREATE INDEX idx_users_email ON public.users USING btree (email);

CREATE INDEX idx_users_google_sub ON public.users USING btree (google_sub);

CREATE INDEX idx_vendor_aliases_vendor ON public.vendor_aliases USING btree (vendor_id);

CREATE INDEX idx_vendor_commitments_vendor ON public.vendor_commitments USING btree (vendor_id, effective_from DESC);

CREATE INDEX idx_vendor_pricing_pair ON public.vendor_pricing USING btree (vendor_id, api_code);

CREATE INDEX idx_vendor_pricing_slab_parent ON public.vendor_pricing_slab USING btree (vendor_pricing_id);

CREATE UNIQUE INDEX idx_vendor_recon_dismissals_item ON public.vendor_recon_dismissals USING btree (vendor, COALESCE(api_code, ''::text), COALESCE(raw_api_name, ''::text), period_month);

CREATE INDEX idx_vendor_usage_daily_api ON public.vendor_usage_daily USING btree (api_code, date);

CREATE INDEX idx_vendor_usage_daily_window ON public.vendor_usage_daily USING btree (date, vendor);

CREATE UNIQUE INDEX sandbox_billing_rules_api_uniq ON public.sandbox_billing_rules USING btree (client_id, api_code, effective_from) WHERE (api_code IS NOT NULL);

CREATE UNIQUE INDEX sandbox_billing_rules_clientwide_uniq ON public.sandbox_billing_rules USING btree (client_id, effective_from) WHERE (api_code IS NULL);

CREATE UNIQUE INDEX uq_alerts_open_key ON public.alerts USING btree (dedupe_key) WHERE (status = 'open'::text);

CREATE UNIQUE INDEX uq_sandbox_class_pair_date ON public.sandbox_classifications USING btree (client_id, api_code, effective_from);

CREATE UNIQUE INDEX uq_usage_daily_log_row ON public.usage_daily USING btree (date, raw_client_name, raw_api_name, COALESCE(hits_via, ''::text), COALESCE(vendor, ''::text)) WHERE (source = 'log'::text);

CREATE UNIQUE INDEX uq_vendor_aliases_alias ON public.vendor_aliases USING btree (lower(alias));

CREATE UNIQUE INDEX uq_vendors_canonical_name ON public.vendors USING btree (lower(canonical_name));

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_snoozed_by_fkey FOREIGN KEY (snoozed_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.api_bundle_members
    ADD CONSTRAINT api_bundle_members_api_code_fkey FOREIGN KEY (api_code) REFERENCES public.apis(product_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.api_bundle_members
    ADD CONSTRAINT api_bundle_members_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.api_bundles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.api_bundle_members
    ADD CONSTRAINT api_bundle_members_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.api_bundles
    ADD CONSTRAINT api_bundles_anchor_api_code_fkey FOREIGN KEY (anchor_api_code) REFERENCES public.apis(product_code);

ALTER TABLE ONLY public.api_bundles
    ADD CONSTRAINT api_bundles_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.api_code_overrides
    ADD CONSTRAINT api_code_overrides_api_code_fkey FOREIGN KEY (api_code) REFERENCES public.apis(product_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.api_code_overrides
    ADD CONSTRAINT api_code_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.billing_periods
    ADD CONSTRAINT billing_periods_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.bundle_pricing
    ADD CONSTRAINT bundle_pricing_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.api_bundles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_operations
    ADD CONSTRAINT client_operations_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.client_operations
    ADD CONSTRAINT client_operations_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.client_slugs
    ADD CONSTRAINT client_slugs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_merged_into_fkey FOREIGN KEY (merged_into) REFERENCES public.clients(id);

ALTER TABLE ONLY public.leak_dismissals
    ADD CONSTRAINT leak_dismissals_api_code_fkey FOREIGN KEY (api_code) REFERENCES public.apis(product_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.leak_dismissals
    ADD CONSTRAINT leak_dismissals_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.leak_dismissals
    ADD CONSTRAINT leak_dismissals_dismissed_by_fkey FOREIGN KEY (dismissed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.manual_entries
    ADD CONSTRAINT manual_entries_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.manual_entries
    ADD CONSTRAINT manual_entries_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.manual_entries
    ADD CONSTRAINT manual_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.manual_entries
    ADD CONSTRAINT manual_entries_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pricing
    ADD CONSTRAINT pricing_api_code_fkey FOREIGN KEY (api_code) REFERENCES public.apis(product_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.pricing
    ADD CONSTRAINT pricing_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pricing_slab
    ADD CONSTRAINT pricing_slab_pricing_id_fkey FOREIGN KEY (pricing_id) REFERENCES public.pricing(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sandbox_billing_rules
    ADD CONSTRAINT sandbox_billing_rules_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sandbox_classifications
    ADD CONSTRAINT sandbox_classifications_api_code_fkey FOREIGN KEY (api_code) REFERENCES public.apis(product_code);

ALTER TABLE ONLY public.sandbox_classifications
    ADD CONSTRAINT sandbox_classifications_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sandbox_classifications
    ADD CONSTRAINT sandbox_classifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.statement_adjustments
    ADD CONSTRAINT statement_adjustments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.statement_adjustments
    ADD CONSTRAINT statement_adjustments_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES public.statements(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.statement_lines
    ADD CONSTRAINT statement_lines_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES public.statements(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.statements
    ADD CONSTRAINT statements_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.statements
    ADD CONSTRAINT statements_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.statements
    ADD CONSTRAINT statements_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.statements
    ADD CONSTRAINT statements_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.billing_periods(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usage_daily
    ADD CONSTRAINT usage_daily_api_code_fkey FOREIGN KEY (api_code) REFERENCES public.apis(product_code) ON DELETE SET NULL;

ALTER TABLE ONLY public.usage_daily
    ADD CONSTRAINT usage_daily_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.usage_daily
    ADD CONSTRAINT usage_daily_manual_entry_id_fkey FOREIGN KEY (manual_entry_id) REFERENCES public.manual_entries(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.usage_daily
    ADD CONSTRAINT usage_daily_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.vendor_aliases
    ADD CONSTRAINT vendor_aliases_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vendor_commitments
    ADD CONSTRAINT vendor_commitments_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);

ALTER TABLE ONLY public.vendor_pricing
    ADD CONSTRAINT vendor_pricing_api_code_fkey FOREIGN KEY (api_code) REFERENCES public.apis(product_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.vendor_pricing_slab
    ADD CONSTRAINT vendor_pricing_slab_vendor_pricing_id_fkey FOREIGN KEY (vendor_pricing_id) REFERENCES public.vendor_pricing(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vendor_pricing
    ADD CONSTRAINT vendor_pricing_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);

ALTER TABLE ONLY public.vendor_recon_dismissals
    ADD CONSTRAINT vendor_recon_dismissals_api_code_fkey FOREIGN KEY (api_code) REFERENCES public.apis(product_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.vendor_recon_dismissals
    ADD CONSTRAINT vendor_recon_dismissals_dismissed_by_fkey FOREIGN KEY (dismissed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.vendor_usage_daily
    ADD CONSTRAINT vendor_usage_daily_api_code_fkey FOREIGN KEY (api_code) REFERENCES public.apis(product_code) ON DELETE SET NULL;
