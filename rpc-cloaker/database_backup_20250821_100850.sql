--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17
-- Dumped by pg_dump version 14.17

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: timescaledb; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS timescaledb WITH SCHEMA public;


--
-- Name: EXTENSION timescaledb; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION timescaledb IS 'Enables scalable inserts and complex queries for time-series data (Community Edition)';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: clean_expired_blacklist(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.clean_expired_blacklist() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired entries
    DELETE FROM ip_blacklist 
    WHERE is_permanent = FALSE 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup event
    INSERT INTO blacklist_events (ip_address, event_type, reason, metadata)
    SELECT '0.0.0.0'::INET, 'cleanup', 'Automatic cleanup of expired entries', 
           jsonb_build_object('deleted_count', deleted_count);
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.clean_expired_blacklist() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.metrics (
    "time" timestamp with time zone NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    metric_type character varying(50) NOT NULL,
    value double precision NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.metrics OWNER TO postgres;

--
-- Name: _direct_view_5; Type: VIEW; Schema: _timescaledb_internal; Owner: postgres
--

CREATE VIEW _timescaledb_internal._direct_view_5 AS
 SELECT public.time_bucket('00:01:00'::interval, metrics."time") AS "time",
    metrics.campaign_id,
    metrics.stream_id,
    count(*) AS total_requests,
    count(*) FILTER (WHERE ((metrics.tags ->> 'is_bot'::text) = 'true'::text)) AS bot_requests,
    count(*) FILTER (WHERE ((metrics.tags ->> 'is_bot'::text) = 'false'::text)) AS human_requests,
    count(*) FILTER (WHERE ((metrics.tags ->> 'page_shown'::text) = 'money'::text)) AS money_page_shown,
    count(*) FILTER (WHERE ((metrics.tags ->> 'page_shown'::text) = 'safe'::text)) AS safe_page_shown,
    avg(((metrics.tags ->> 'response_time_ms'::text))::double precision) AS avg_response_time_ms
   FROM public.metrics
  WHERE ((metrics.metric_type)::text = 'page_view'::text)
  GROUP BY (public.time_bucket('00:01:00'::interval, metrics."time")), metrics.campaign_id, metrics.stream_id;


ALTER TABLE _timescaledb_internal._direct_view_5 OWNER TO postgres;

--
-- Name: _materialized_hypertable_5; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._materialized_hypertable_5 (
    "time" timestamp with time zone NOT NULL,
    campaign_id uuid,
    stream_id uuid,
    total_requests bigint,
    bot_requests bigint,
    human_requests bigint,
    money_page_shown bigint,
    safe_page_shown bigint,
    avg_response_time_ms double precision
);


ALTER TABLE _timescaledb_internal._materialized_hypertable_5 OWNER TO postgres;

--
-- Name: _partial_view_5; Type: VIEW; Schema: _timescaledb_internal; Owner: postgres
--

CREATE VIEW _timescaledb_internal._partial_view_5 AS
 SELECT public.time_bucket('00:01:00'::interval, metrics."time") AS "time",
    metrics.campaign_id,
    metrics.stream_id,
    count(*) AS total_requests,
    count(*) FILTER (WHERE ((metrics.tags ->> 'is_bot'::text) = 'true'::text)) AS bot_requests,
    count(*) FILTER (WHERE ((metrics.tags ->> 'is_bot'::text) = 'false'::text)) AS human_requests,
    count(*) FILTER (WHERE ((metrics.tags ->> 'page_shown'::text) = 'money'::text)) AS money_page_shown,
    count(*) FILTER (WHERE ((metrics.tags ->> 'page_shown'::text) = 'safe'::text)) AS safe_page_shown,
    avg(((metrics.tags ->> 'response_time_ms'::text))::double precision) AS avg_response_time_ms
   FROM public.metrics
  WHERE ((metrics.metric_type)::text = 'page_view'::text)
  GROUP BY (public.time_bucket('00:01:00'::interval, metrics."time")), metrics.campaign_id, metrics.stream_id;


ALTER TABLE _timescaledb_internal._partial_view_5 OWNER TO postgres;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    action character varying(255) NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    details jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: blacklist_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blacklist_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_address inet NOT NULL,
    event_type character varying(50) NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    user_id uuid,
    campaign_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.blacklist_events OWNER TO postgres;

--
-- Name: TABLE blacklist_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.blacklist_events IS 'Karaliste olayları log tablosu - analitik ve denetim için';


--
-- Name: bot_detection_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bot_detection_results (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    traffic_log_id uuid NOT NULL,
    fingerprint_hash character varying(255),
    detection_method character varying(50),
    confidence_score double precision,
    details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.bot_detection_results OWNER TO postgres;

--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    money_page_url text NOT NULL,
    safe_page_url text NOT NULL,
    redirect_type character varying(50) DEFAULT '302'::character varying NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    money_page_redirect_type character varying(50) DEFAULT '302'::character varying NOT NULL,
    safe_page_redirect_type character varying(50) DEFAULT 'direct'::character varying NOT NULL,
    CONSTRAINT check_money_page_redirect_type CHECK (((money_page_redirect_type)::text = ANY ((ARRAY['301'::character varying, '302'::character varying, 'js'::character varying, 'meta'::character varying, 'direct'::character varying, 'no_action'::character varying])::text[]))),
    CONSTRAINT check_safe_page_redirect_type CHECK (((safe_page_redirect_type)::text = ANY ((ARRAY['301'::character varying, '302'::character varying, 'js'::character varying, 'meta'::character varying, 'direct'::character varying, 'no_action'::character varying])::text[])))
);


ALTER TABLE public.campaigns OWNER TO postgres;

--
-- Name: COLUMN campaigns.redirect_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.campaigns.redirect_type IS 'Legacy redirect type - will be deprecated';


--
-- Name: COLUMN campaigns.money_page_redirect_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.campaigns.money_page_redirect_type IS 'Redirect type for bots (money page): 301, 302, js, meta, direct, no_action';


--
-- Name: COLUMN campaigns.safe_page_redirect_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.campaigns.safe_page_redirect_type IS 'Redirect type for non-bots (safe page): 301, 302, js, meta, direct, no_action';


--
-- Name: configurations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configurations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    key character varying(255) NOT NULL,
    value jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.configurations OWNER TO postgres;

--
-- Name: ip_blacklist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ip_blacklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_address inet NOT NULL,
    reason character varying(255) NOT NULL,
    detection_type character varying(100) NOT NULL,
    confidence_score double precision DEFAULT 0.0,
    detection_count integer DEFAULT 1,
    first_detected timestamp with time zone DEFAULT now(),
    last_detected timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    is_permanent boolean DEFAULT false,
    campaign_id uuid,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ip_blacklist OWNER TO postgres;

--
-- Name: TABLE ip_blacklist; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ip_blacklist IS 'Merkezi IP karaliste sistemi - tüm kullanıcılar arasında paylaşılan bot IP listesi';


--
-- Name: ip_reputation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ip_reputation (
    ip_address inet NOT NULL,
    reputation_score integer DEFAULT 100,
    total_detections integer DEFAULT 0,
    last_activity timestamp with time zone DEFAULT now(),
    risk_category character varying(50) DEFAULT 'unknown'::character varying,
    data_sources jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ip_reputation OWNER TO postgres;

--
-- Name: TABLE ip_reputation; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ip_reputation IS 'IP itibar puanlama sistemi - IP geçmişi ve risk değerlendirmesi';


--
-- Name: ml_training_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ml_training_data (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    visitor_fingerprint character varying(255),
    features jsonb NOT NULL,
    label character varying(50) NOT NULL,
    confidence double precision,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ml_training_data OWNER TO postgres;

--
-- Name: stats_1d; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stats_1d (
    "time" timestamp with time zone NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    total_requests integer DEFAULT 0,
    bot_requests integer DEFAULT 0,
    human_requests integer DEFAULT 0,
    money_page_shown integer DEFAULT 0,
    safe_page_shown integer DEFAULT 0,
    avg_response_time_ms double precision,
    unique_visitors integer DEFAULT 0,
    countries jsonb DEFAULT '{}'::jsonb,
    devices jsonb DEFAULT '{}'::jsonb,
    browsers jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.stats_1d OWNER TO postgres;

--
-- Name: stats_1h; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stats_1h (
    "time" timestamp with time zone NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    total_requests integer DEFAULT 0,
    bot_requests integer DEFAULT 0,
    human_requests integer DEFAULT 0,
    money_page_shown integer DEFAULT 0,
    safe_page_shown integer DEFAULT 0,
    avg_response_time_ms double precision,
    unique_visitors integer DEFAULT 0,
    countries jsonb DEFAULT '{}'::jsonb,
    devices jsonb DEFAULT '{}'::jsonb,
    browsers jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.stats_1h OWNER TO postgres;

--
-- Name: stats_1m; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stats_1m (
    "time" timestamp with time zone NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    total_requests integer DEFAULT 0,
    bot_requests integer DEFAULT 0,
    human_requests integer DEFAULT 0,
    money_page_shown integer DEFAULT 0,
    safe_page_shown integer DEFAULT 0,
    avg_response_time_ms double precision,
    unique_visitors integer DEFAULT 0,
    countries jsonb DEFAULT '{}'::jsonb,
    devices jsonb DEFAULT '{}'::jsonb,
    browsers jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.stats_1m OWNER TO postgres;

--
-- Name: stats_1m_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.stats_1m_view AS
 SELECT _materialized_hypertable_5."time",
    _materialized_hypertable_5.campaign_id,
    _materialized_hypertable_5.stream_id,
    _materialized_hypertable_5.total_requests,
    _materialized_hypertable_5.bot_requests,
    _materialized_hypertable_5.human_requests,
    _materialized_hypertable_5.money_page_shown,
    _materialized_hypertable_5.safe_page_shown,
    _materialized_hypertable_5.avg_response_time_ms
   FROM _timescaledb_internal._materialized_hypertable_5;


ALTER TABLE public.stats_1m_view OWNER TO postgres;

--
-- Name: streams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.streams (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    weight integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true,
    money_page_override text,
    safe_page_override text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.streams OWNER TO postgres;

--
-- Name: targeting_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.targeting_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    stream_id uuid NOT NULL,
    rule_type character varying(50) NOT NULL,
    operator character varying(50) NOT NULL,
    value jsonb NOT NULL,
    is_include boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.targeting_rules OWNER TO postgres;

--
-- Name: traffic_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
)
PARTITION BY RANGE (created_at);


ALTER TABLE public.traffic_logs OWNER TO postgres;

--
-- Name: traffic_logs_2025_08_21; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_08_21 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_08_21 OWNER TO postgres;

--
-- Name: traffic_logs_2025_08_22; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_08_22 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_08_22 OWNER TO postgres;

--
-- Name: traffic_logs_2025_08_23; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_08_23 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_08_23 OWNER TO postgres;

--
-- Name: traffic_logs_2025_08_24; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_08_24 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_08_24 OWNER TO postgres;

--
-- Name: traffic_logs_2025_08_25; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_08_25 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_08_25 OWNER TO postgres;

--
-- Name: traffic_logs_2025_08_26; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_08_26 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_08_26 OWNER TO postgres;

--
-- Name: traffic_logs_2025_08_27; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_08_27 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_08_27 OWNER TO postgres;

--
-- Name: traffic_logs_2025_08_28; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_08_28 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_08_28 OWNER TO postgres;

--
-- Name: traffic_logs_2025_08_29; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_08_29 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_08_29 OWNER TO postgres;

--
-- Name: traffic_logs_2025_08_30; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_08_30 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_08_30 OWNER TO postgres;

--
-- Name: traffic_logs_2025_08_31; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_08_31 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_08_31 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_01; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_01 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_01 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_02; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_02 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_02 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_03; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_03 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_03 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_04; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_04 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_04 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_05; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_05 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_05 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_06; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_06 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_06 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_07; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_07 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_07 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_08; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_08 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_08 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_09; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_09 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_09 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_10; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_10 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_10 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_11; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_11 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_11 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_12; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_12 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_12 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_13; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_13 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_13 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_14; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_14 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_14 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_15; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_15 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_15 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_16; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_16 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_16 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_17; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_17 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_17 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_18; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_18 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_18 OWNER TO postgres;

--
-- Name: traffic_logs_2025_09_19; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_logs_2025_09_19 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    stream_id uuid,
    visitor_id character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    referer text,
    country_code character varying(2),
    city character varying(255),
    device_type character varying(50),
    browser character varying(50),
    os character varying(50),
    is_bot boolean DEFAULT false,
    bot_score double precision,
    decision character varying(50) NOT NULL,
    page_shown character varying(50) NOT NULL,
    response_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.traffic_logs_2025_09_19 OWNER TO postgres;

--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    ip_address inet,
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_sessions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: traffic_logs_2025_08_21; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_08_21 FOR VALUES FROM ('2025-08-21 00:00:00') TO ('2025-08-22 00:00:00');


--
-- Name: traffic_logs_2025_08_22; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_08_22 FOR VALUES FROM ('2025-08-22 00:00:00') TO ('2025-08-23 00:00:00');


--
-- Name: traffic_logs_2025_08_23; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_08_23 FOR VALUES FROM ('2025-08-23 00:00:00') TO ('2025-08-24 00:00:00');


--
-- Name: traffic_logs_2025_08_24; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_08_24 FOR VALUES FROM ('2025-08-24 00:00:00') TO ('2025-08-25 00:00:00');


--
-- Name: traffic_logs_2025_08_25; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_08_25 FOR VALUES FROM ('2025-08-25 00:00:00') TO ('2025-08-26 00:00:00');


--
-- Name: traffic_logs_2025_08_26; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_08_26 FOR VALUES FROM ('2025-08-26 00:00:00') TO ('2025-08-27 00:00:00');


--
-- Name: traffic_logs_2025_08_27; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_08_27 FOR VALUES FROM ('2025-08-27 00:00:00') TO ('2025-08-28 00:00:00');


--
-- Name: traffic_logs_2025_08_28; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_08_28 FOR VALUES FROM ('2025-08-28 00:00:00') TO ('2025-08-29 00:00:00');


--
-- Name: traffic_logs_2025_08_29; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_08_29 FOR VALUES FROM ('2025-08-29 00:00:00') TO ('2025-08-30 00:00:00');


--
-- Name: traffic_logs_2025_08_30; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_08_30 FOR VALUES FROM ('2025-08-30 00:00:00') TO ('2025-08-31 00:00:00');


--
-- Name: traffic_logs_2025_08_31; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_08_31 FOR VALUES FROM ('2025-08-31 00:00:00') TO ('2025-09-01 00:00:00');


--
-- Name: traffic_logs_2025_09_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_01 FOR VALUES FROM ('2025-09-01 00:00:00') TO ('2025-09-02 00:00:00');


--
-- Name: traffic_logs_2025_09_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_02 FOR VALUES FROM ('2025-09-02 00:00:00') TO ('2025-09-03 00:00:00');


--
-- Name: traffic_logs_2025_09_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_03 FOR VALUES FROM ('2025-09-03 00:00:00') TO ('2025-09-04 00:00:00');


--
-- Name: traffic_logs_2025_09_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_04 FOR VALUES FROM ('2025-09-04 00:00:00') TO ('2025-09-05 00:00:00');


--
-- Name: traffic_logs_2025_09_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_05 FOR VALUES FROM ('2025-09-05 00:00:00') TO ('2025-09-06 00:00:00');


--
-- Name: traffic_logs_2025_09_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_06 FOR VALUES FROM ('2025-09-06 00:00:00') TO ('2025-09-07 00:00:00');


--
-- Name: traffic_logs_2025_09_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_07 FOR VALUES FROM ('2025-09-07 00:00:00') TO ('2025-09-08 00:00:00');


--
-- Name: traffic_logs_2025_09_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_08 FOR VALUES FROM ('2025-09-08 00:00:00') TO ('2025-09-09 00:00:00');


--
-- Name: traffic_logs_2025_09_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_09 FOR VALUES FROM ('2025-09-09 00:00:00') TO ('2025-09-10 00:00:00');


--
-- Name: traffic_logs_2025_09_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_10 FOR VALUES FROM ('2025-09-10 00:00:00') TO ('2025-09-11 00:00:00');


--
-- Name: traffic_logs_2025_09_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_11 FOR VALUES FROM ('2025-09-11 00:00:00') TO ('2025-09-12 00:00:00');


--
-- Name: traffic_logs_2025_09_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_12 FOR VALUES FROM ('2025-09-12 00:00:00') TO ('2025-09-13 00:00:00');


--
-- Name: traffic_logs_2025_09_13; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_13 FOR VALUES FROM ('2025-09-13 00:00:00') TO ('2025-09-14 00:00:00');


--
-- Name: traffic_logs_2025_09_14; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_14 FOR VALUES FROM ('2025-09-14 00:00:00') TO ('2025-09-15 00:00:00');


--
-- Name: traffic_logs_2025_09_15; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_15 FOR VALUES FROM ('2025-09-15 00:00:00') TO ('2025-09-16 00:00:00');


--
-- Name: traffic_logs_2025_09_16; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_16 FOR VALUES FROM ('2025-09-16 00:00:00') TO ('2025-09-17 00:00:00');


--
-- Name: traffic_logs_2025_09_17; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_17 FOR VALUES FROM ('2025-09-17 00:00:00') TO ('2025-09-18 00:00:00');


--
-- Name: traffic_logs_2025_09_18; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_18 FOR VALUES FROM ('2025-09-18 00:00:00') TO ('2025-09-19 00:00:00');


--
-- Name: traffic_logs_2025_09_19; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs ATTACH PARTITION public.traffic_logs_2025_09_19 FOR VALUES FROM ('2025-09-19 00:00:00') TO ('2025-09-20 00:00:00');


--
-- Data for Name: hypertable; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.hypertable (id, schema_name, table_name, associated_schema_name, associated_table_prefix, num_dimensions, chunk_sizing_func_schema, chunk_sizing_func_name, chunk_target_size, compression_state, compressed_hypertable_id, status) FROM stdin;
1	public	metrics	_timescaledb_internal	_hyper_1	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
2	public	stats_1m	_timescaledb_internal	_hyper_2	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
3	public	stats_1h	_timescaledb_internal	_hyper_3	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
4	public	stats_1d	_timescaledb_internal	_hyper_4	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
5	_timescaledb_internal	_materialized_hypertable_5	_timescaledb_internal	_hyper_5	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
\.


--
-- Data for Name: chunk; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.chunk (id, hypertable_id, schema_name, table_name, compressed_chunk_id, dropped, status, osm_chunk, creation_time) FROM stdin;
\.


--
-- Data for Name: chunk_column_stats; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.chunk_column_stats (id, hypertable_id, chunk_id, column_name, range_start, range_end, valid) FROM stdin;
\.


--
-- Data for Name: dimension; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.dimension (id, hypertable_id, column_name, column_type, aligned, num_slices, partitioning_func_schema, partitioning_func, interval_length, compress_interval_length, integer_now_func_schema, integer_now_func) FROM stdin;
1	1	time	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
2	2	time	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
3	3	time	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
4	4	time	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
5	5	time	timestamp with time zone	t	\N	\N	\N	6048000000000	\N	\N	\N
\.


--
-- Data for Name: dimension_slice; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.dimension_slice (id, dimension_id, range_start, range_end) FROM stdin;
\.


--
-- Data for Name: chunk_constraint; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.chunk_constraint (chunk_id, dimension_slice_id, constraint_name, hypertable_constraint_name) FROM stdin;
\.


--
-- Data for Name: chunk_index; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.chunk_index (chunk_id, index_name, hypertable_id, hypertable_index_name) FROM stdin;
\.


--
-- Data for Name: compression_chunk_size; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.compression_chunk_size (chunk_id, compressed_chunk_id, uncompressed_heap_size, uncompressed_toast_size, uncompressed_index_size, compressed_heap_size, compressed_toast_size, compressed_index_size, numrows_pre_compression, numrows_post_compression, numrows_frozen_immediately) FROM stdin;
\.


--
-- Data for Name: compression_settings; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.compression_settings (relid, compress_relid, segmentby, orderby, orderby_desc, orderby_nullsfirst) FROM stdin;
\.


--
-- Data for Name: continuous_agg; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.continuous_agg (mat_hypertable_id, raw_hypertable_id, parent_mat_hypertable_id, user_view_schema, user_view_name, partial_view_schema, partial_view_name, direct_view_schema, direct_view_name, materialized_only, finalized) FROM stdin;
5	1	\N	public	stats_1m_view	_timescaledb_internal	_partial_view_5	_timescaledb_internal	_direct_view_5	t	t
\.


--
-- Data for Name: continuous_agg_migrate_plan; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.continuous_agg_migrate_plan (mat_hypertable_id, start_ts, end_ts, user_view_definition) FROM stdin;
\.


--
-- Data for Name: continuous_agg_migrate_plan_step; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.continuous_agg_migrate_plan_step (mat_hypertable_id, step_id, status, start_ts, end_ts, type, config) FROM stdin;
\.


--
-- Data for Name: continuous_aggs_bucket_function; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.continuous_aggs_bucket_function (mat_hypertable_id, bucket_func, bucket_width, bucket_origin, bucket_offset, bucket_timezone, bucket_fixed_width) FROM stdin;
5	public.time_bucket(interval,timestamp with time zone)	00:01:00	\N	\N	\N	t
\.


--
-- Data for Name: continuous_aggs_hypertable_invalidation_log; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.continuous_aggs_hypertable_invalidation_log (hypertable_id, lowest_modified_value, greatest_modified_value) FROM stdin;
\.


--
-- Data for Name: continuous_aggs_invalidation_threshold; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.continuous_aggs_invalidation_threshold (hypertable_id, watermark) FROM stdin;
1	1755756420000000
\.


--
-- Data for Name: continuous_aggs_materialization_invalidation_log; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.continuous_aggs_materialization_invalidation_log (materialization_id, lowest_modified_value, greatest_modified_value) FROM stdin;
5	-9223372036854775808	1755749279999999
5	1755756420000000	9223372036854775807
\.


--
-- Data for Name: continuous_aggs_watermark; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.continuous_aggs_watermark (mat_hypertable_id, watermark) FROM stdin;
5	-210866803200000000
\.


--
-- Data for Name: metadata; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.metadata (key, value, include_in_telemetry) FROM stdin;
install_timestamp	2025-08-21 04:12:33.718932+00	t
timescaledb_version	2.19.3	f
exported_uuid	4ae2fff4-6f91-4cbe-871f-1c44faae9574	t
\.


--
-- Data for Name: tablespace; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: postgres
--

COPY _timescaledb_catalog.tablespace (id, hypertable_id, tablespace_name) FROM stdin;
\.


--
-- Data for Name: bgw_job; Type: TABLE DATA; Schema: _timescaledb_config; Owner: postgres
--

COPY _timescaledb_config.bgw_job (id, application_name, schedule_interval, max_runtime, max_retries, retry_period, proc_schema, proc_name, owner, scheduled, fixed_schedule, initial_start, hypertable_id, config, check_schema, check_name, timezone) FROM stdin;
1000	Refresh Continuous Aggregate Policy [1000]	00:01:00	00:00:00	-1	00:01:00	_timescaledb_functions	policy_refresh_continuous_aggregate	postgres	t	f	\N	5	{"end_offset": "00:01:00", "start_offset": "00:05:00", "mat_hypertable_id": 5}	_timescaledb_functions	policy_refresh_continuous_aggregate_check	\N
1001	Retention Policy [1001]	1 day	00:05:00	-1	00:05:00	_timescaledb_functions	policy_retention	postgres	t	f	\N	1	{"drop_after": "7 days", "hypertable_id": 1}	_timescaledb_functions	policy_retention_check	\N
1002	Retention Policy [1002]	1 day	00:05:00	-1	00:05:00	_timescaledb_functions	policy_retention	postgres	t	f	\N	2	{"drop_after": "30 days", "hypertable_id": 2}	_timescaledb_functions	policy_retention_check	\N
1003	Retention Policy [1003]	1 day	00:05:00	-1	00:05:00	_timescaledb_functions	policy_retention	postgres	t	f	\N	3	{"drop_after": "90 days", "hypertable_id": 3}	_timescaledb_functions	policy_retention_check	\N
1004	Retention Policy [1004]	1 day	00:05:00	-1	00:05:00	_timescaledb_functions	policy_retention	postgres	t	f	\N	4	{"drop_after": "365 days", "hypertable_id": 4}	_timescaledb_functions	policy_retention_check	\N
\.


--
-- Data for Name: _materialized_hypertable_5; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: postgres
--

COPY _timescaledb_internal._materialized_hypertable_5 ("time", campaign_id, stream_id, total_requests, bot_requests, human_requests, money_page_shown, safe_page_shown, avg_response_time_ms) FROM stdin;
\.


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_logs (id, user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: blacklist_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.blacklist_events (id, ip_address, event_type, reason, metadata, user_id, campaign_id, created_at) FROM stdin;
\.


--
-- Data for Name: bot_detection_results; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bot_detection_results (id, traffic_log_id, fingerprint_hash, detection_method, confidence_score, details, created_at) FROM stdin;
\.


--
-- Data for Name: campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.campaigns (id, user_id, name, status, money_page_url, safe_page_url, redirect_type, notes, created_at, updated_at, money_page_redirect_type, safe_page_redirect_type) FROM stdin;
33cc25b4-b1fc-482e-8550-a10968be9244	b897d288-0bb8-499d-9763-34885d0eb58a	selam	active	https://google.com	https://google.com	302	\N	2025-08-21 04:30:21.531445	2025-08-21 04:31:14.98239	302	direct
654197af-ec3f-4555-be18-201d1ab5319e	65975cf8-53e9-49a1-9c9e-4af1f23b90fe	Test Campaign with Separate Redirects	active	https://money-page.example.com	https://safe-page.example.com	302	Bots get 302 redirect, humans get blocked	2025-08-21 04:37:22.467403	2025-08-21 04:37:22.467403	302	no_action
\.


--
-- Data for Name: configurations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.configurations (id, user_id, key, value, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ip_blacklist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ip_blacklist (id, ip_address, reason, detection_type, confidence_score, detection_count, first_detected, last_detected, expires_at, is_permanent, campaign_id, user_id, created_at, updated_at) FROM stdin;
a455d682-9edb-4752-9969-a5a570574021	192.168.1.100	Python bot detected	bot	0.95	1	2025-08-21 05:45:21.622854+00	2025-08-21 05:45:21.622854+00	2025-08-22 05:45:21.622854+00	f	\N	\N	2025-08-21 05:45:21.622854+00	2025-08-21 05:45:21.622854+00
8d54d76f-35df-4500-a413-e9117db86605	10.0.0.50	Suspicious header patterns	suspicious	0.75	1	2025-08-21 05:45:21.622854+00	2025-08-21 05:45:21.622854+00	2025-08-21 17:45:21.622854+00	f	\N	\N	2025-08-21 05:45:21.622854+00	2025-08-21 05:45:21.622854+00
e24ea41e-ff08-48e4-b337-398ad7447fe6	203.0.113.1	Manual ban - spam	manual	1	1	2025-08-21 05:45:21.622854+00	2025-08-21 05:45:21.622854+00	\N	f	\N	\N	2025-08-21 05:45:21.622854+00	2025-08-21 05:45:21.622854+00
\.


--
-- Data for Name: ip_reputation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ip_reputation (ip_address, reputation_score, total_detections, last_activity, risk_category, data_sources, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: metrics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.metrics ("time", campaign_id, stream_id, metric_type, value, tags) FROM stdin;
\.


--
-- Data for Name: ml_training_data; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ml_training_data (id, visitor_fingerprint, features, label, confidence, created_at) FROM stdin;
\.


--
-- Data for Name: stats_1d; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stats_1d ("time", campaign_id, stream_id, total_requests, bot_requests, human_requests, money_page_shown, safe_page_shown, avg_response_time_ms, unique_visitors, countries, devices, browsers) FROM stdin;
\.


--
-- Data for Name: stats_1h; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stats_1h ("time", campaign_id, stream_id, total_requests, bot_requests, human_requests, money_page_shown, safe_page_shown, avg_response_time_ms, unique_visitors, countries, devices, browsers) FROM stdin;
\.


--
-- Data for Name: stats_1m; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stats_1m ("time", campaign_id, stream_id, total_requests, bot_requests, human_requests, money_page_shown, safe_page_shown, avg_response_time_ms, unique_visitors, countries, devices, browsers) FROM stdin;
\.


--
-- Data for Name: streams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.streams (id, campaign_id, name, weight, is_active, money_page_override, safe_page_override, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: targeting_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.targeting_rules (id, stream_id, rule_type, operator, value, is_include, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_08_21; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_08_21 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_08_22; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_08_22 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_08_23; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_08_23 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_08_24; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_08_24 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_08_25; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_08_25 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_08_26; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_08_26 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_08_27; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_08_27 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_08_28; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_08_28 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_08_29; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_08_29 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_08_30; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_08_30 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_08_31; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_08_31 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_01; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_01 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_02; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_02 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_03; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_03 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_04; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_04 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_05; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_05 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_06; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_06 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_07; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_07 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_08; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_08 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_09; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_09 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_10; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_10 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_11; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_11 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_12; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_12 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_13; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_13 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_14; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_14 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_15; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_15 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_16; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_16 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_17; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_17 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_18; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_18 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: traffic_logs_2025_09_19; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_logs_2025_09_19 (id, campaign_id, stream_id, visitor_id, ip_address, user_agent, referer, country_code, city, device_type, browser, os, is_bot, bot_score, decision, page_shown, response_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, name, role, is_active, email_verified, last_login, created_at, updated_at) FROM stdin;
65975cf8-53e9-49a1-9c9e-4af1f23b90fe	test@example.com	$2b$10$WskT0yCN.JZ2qayTnby4ROWNLtmee0hsraZXXdRLBKcOiokCvn0oO	Test User	user	t	f	\N	2025-08-21 04:27:50.229324	2025-08-21 04:27:50.229324
b897d288-0bb8-499d-9763-34885d0eb58a	sasa@sasa.com	$2b$10$X1ZIaHx3eopXJKDmKquyQeclrQQ1N04X6KWkmorE7hKM/tpoPh4g2	sasa sasa	user	t	f	\N	2025-08-21 04:28:30.595471	2025-08-21 04:28:30.595471
\.


--
-- Name: chunk_column_stats_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: postgres
--

SELECT pg_catalog.setval('_timescaledb_catalog.chunk_column_stats_id_seq', 1, false);


--
-- Name: chunk_constraint_name; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: postgres
--

SELECT pg_catalog.setval('_timescaledb_catalog.chunk_constraint_name', 1, false);


--
-- Name: chunk_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: postgres
--

SELECT pg_catalog.setval('_timescaledb_catalog.chunk_id_seq', 1, false);


--
-- Name: continuous_agg_migrate_plan_step_step_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: postgres
--

SELECT pg_catalog.setval('_timescaledb_catalog.continuous_agg_migrate_plan_step_step_id_seq', 1, false);


--
-- Name: dimension_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: postgres
--

SELECT pg_catalog.setval('_timescaledb_catalog.dimension_id_seq', 33, true);


--
-- Name: dimension_slice_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: postgres
--

SELECT pg_catalog.setval('_timescaledb_catalog.dimension_slice_id_seq', 1, false);


--
-- Name: hypertable_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: postgres
--

SELECT pg_catalog.setval('_timescaledb_catalog.hypertable_id_seq', 33, true);


--
-- Name: bgw_job_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_config; Owner: postgres
--

SELECT pg_catalog.setval('_timescaledb_config.bgw_job_id_seq', 1032, true);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: blacklist_events blacklist_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blacklist_events
    ADD CONSTRAINT blacklist_events_pkey PRIMARY KEY (id);


--
-- Name: bot_detection_results bot_detection_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bot_detection_results
    ADD CONSTRAINT bot_detection_results_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: configurations configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configurations
    ADD CONSTRAINT configurations_pkey PRIMARY KEY (id);


--
-- Name: configurations configurations_user_id_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configurations
    ADD CONSTRAINT configurations_user_id_key_key UNIQUE (user_id, key);


--
-- Name: ip_blacklist ip_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_blacklist
    ADD CONSTRAINT ip_blacklist_pkey PRIMARY KEY (id);


--
-- Name: ip_reputation ip_reputation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_reputation
    ADD CONSTRAINT ip_reputation_pkey PRIMARY KEY (ip_address);


--
-- Name: ml_training_data ml_training_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ml_training_data
    ADD CONSTRAINT ml_training_data_pkey PRIMARY KEY (id);


--
-- Name: streams streams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.streams
    ADD CONSTRAINT streams_pkey PRIMARY KEY (id);


--
-- Name: targeting_rules targeting_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.targeting_rules
    ADD CONSTRAINT targeting_rules_pkey PRIMARY KEY (id);


--
-- Name: traffic_logs traffic_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs
    ADD CONSTRAINT traffic_logs_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_08_21 traffic_logs_2025_08_21_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_08_21
    ADD CONSTRAINT traffic_logs_2025_08_21_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_08_22 traffic_logs_2025_08_22_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_08_22
    ADD CONSTRAINT traffic_logs_2025_08_22_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_08_23 traffic_logs_2025_08_23_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_08_23
    ADD CONSTRAINT traffic_logs_2025_08_23_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_08_24 traffic_logs_2025_08_24_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_08_24
    ADD CONSTRAINT traffic_logs_2025_08_24_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_08_25 traffic_logs_2025_08_25_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_08_25
    ADD CONSTRAINT traffic_logs_2025_08_25_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_08_26 traffic_logs_2025_08_26_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_08_26
    ADD CONSTRAINT traffic_logs_2025_08_26_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_08_27 traffic_logs_2025_08_27_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_08_27
    ADD CONSTRAINT traffic_logs_2025_08_27_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_08_28 traffic_logs_2025_08_28_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_08_28
    ADD CONSTRAINT traffic_logs_2025_08_28_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_08_29 traffic_logs_2025_08_29_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_08_29
    ADD CONSTRAINT traffic_logs_2025_08_29_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_08_30 traffic_logs_2025_08_30_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_08_30
    ADD CONSTRAINT traffic_logs_2025_08_30_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_08_31 traffic_logs_2025_08_31_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_08_31
    ADD CONSTRAINT traffic_logs_2025_08_31_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_01 traffic_logs_2025_09_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_01
    ADD CONSTRAINT traffic_logs_2025_09_01_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_02 traffic_logs_2025_09_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_02
    ADD CONSTRAINT traffic_logs_2025_09_02_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_03 traffic_logs_2025_09_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_03
    ADD CONSTRAINT traffic_logs_2025_09_03_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_04 traffic_logs_2025_09_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_04
    ADD CONSTRAINT traffic_logs_2025_09_04_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_05 traffic_logs_2025_09_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_05
    ADD CONSTRAINT traffic_logs_2025_09_05_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_06 traffic_logs_2025_09_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_06
    ADD CONSTRAINT traffic_logs_2025_09_06_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_07 traffic_logs_2025_09_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_07
    ADD CONSTRAINT traffic_logs_2025_09_07_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_08 traffic_logs_2025_09_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_08
    ADD CONSTRAINT traffic_logs_2025_09_08_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_09 traffic_logs_2025_09_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_09
    ADD CONSTRAINT traffic_logs_2025_09_09_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_10 traffic_logs_2025_09_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_10
    ADD CONSTRAINT traffic_logs_2025_09_10_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_11 traffic_logs_2025_09_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_11
    ADD CONSTRAINT traffic_logs_2025_09_11_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_12 traffic_logs_2025_09_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_12
    ADD CONSTRAINT traffic_logs_2025_09_12_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_13 traffic_logs_2025_09_13_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_13
    ADD CONSTRAINT traffic_logs_2025_09_13_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_14 traffic_logs_2025_09_14_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_14
    ADD CONSTRAINT traffic_logs_2025_09_14_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_15 traffic_logs_2025_09_15_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_15
    ADD CONSTRAINT traffic_logs_2025_09_15_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_16 traffic_logs_2025_09_16_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_16
    ADD CONSTRAINT traffic_logs_2025_09_16_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_17 traffic_logs_2025_09_17_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_17
    ADD CONSTRAINT traffic_logs_2025_09_17_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_18 traffic_logs_2025_09_18_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_18
    ADD CONSTRAINT traffic_logs_2025_09_18_pkey PRIMARY KEY (id, created_at);


--
-- Name: traffic_logs_2025_09_19 traffic_logs_2025_09_19_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_logs_2025_09_19
    ADD CONSTRAINT traffic_logs_2025_09_19_pkey PRIMARY KEY (id, created_at);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: _materialized_hypertable_5_campaign_id_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _materialized_hypertable_5_campaign_id_time_idx ON _timescaledb_internal._materialized_hypertable_5 USING btree (campaign_id, "time" DESC);


--
-- Name: _materialized_hypertable_5_stream_id_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _materialized_hypertable_5_stream_id_time_idx ON _timescaledb_internal._materialized_hypertable_5 USING btree (stream_id, "time" DESC);


--
-- Name: _materialized_hypertable_5_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _materialized_hypertable_5_time_idx ON _timescaledb_internal._materialized_hypertable_5 USING btree ("time" DESC);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at);


--
-- Name: idx_activity_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);


--
-- Name: idx_blacklist_events_ip; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blacklist_events_ip ON public.blacklist_events USING btree (ip_address);


--
-- Name: idx_blacklist_events_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blacklist_events_time ON public.blacklist_events USING btree (created_at);


--
-- Name: idx_blacklist_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blacklist_events_type ON public.blacklist_events USING btree (event_type);


--
-- Name: idx_bot_detection_traffic_log; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bot_detection_traffic_log ON public.bot_detection_results USING btree (traffic_log_id);


--
-- Name: idx_campaigns_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status);


--
-- Name: idx_campaigns_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaigns_user_id ON public.campaigns USING btree (user_id);


--
-- Name: idx_ip_blacklist_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ip_blacklist_campaign ON public.ip_blacklist USING btree (campaign_id);


--
-- Name: idx_ip_blacklist_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ip_blacklist_expires ON public.ip_blacklist USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_ip_blacklist_ip; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_ip_blacklist_ip ON public.ip_blacklist USING btree (ip_address);


--
-- Name: idx_ip_blacklist_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ip_blacklist_user ON public.ip_blacklist USING btree (user_id);


--
-- Name: idx_metrics_campaign_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_metrics_campaign_time ON public.metrics USING btree (campaign_id, "time" DESC);


--
-- Name: idx_metrics_type_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_metrics_type_time ON public.metrics USING btree (metric_type, "time" DESC);


--
-- Name: idx_ml_training_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ml_training_created_at ON public.ml_training_data USING btree (created_at);


--
-- Name: idx_streams_campaign_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_streams_campaign_id ON public.streams USING btree (campaign_id);


--
-- Name: idx_targeting_rules_stream_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_targeting_rules_stream_id ON public.targeting_rules USING btree (stream_id);


--
-- Name: idx_traffic_logs_campaign_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_traffic_logs_campaign_id ON ONLY public.traffic_logs USING btree (campaign_id);


--
-- Name: idx_traffic_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_traffic_logs_created_at ON ONLY public.traffic_logs USING btree (created_at);


--
-- Name: idx_traffic_logs_ip_address; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_traffic_logs_ip_address ON ONLY public.traffic_logs USING btree (ip_address);


--
-- Name: idx_traffic_logs_visitor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_traffic_logs_visitor_id ON ONLY public.traffic_logs USING btree (visitor_id);


--
-- Name: idx_user_sessions_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (token_hash);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: metrics_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX metrics_time_idx ON public.metrics USING btree ("time" DESC);


--
-- Name: stats_1d_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stats_1d_time_idx ON public.stats_1d USING btree ("time" DESC);


--
-- Name: stats_1h_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stats_1h_time_idx ON public.stats_1h USING btree ("time" DESC);


--
-- Name: stats_1m_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stats_1m_time_idx ON public.stats_1m USING btree ("time" DESC);


--
-- Name: traffic_logs_2025_08_21_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_21_campaign_id_idx ON public.traffic_logs_2025_08_21 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_08_21_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_21_created_at_idx ON public.traffic_logs_2025_08_21 USING btree (created_at);


--
-- Name: traffic_logs_2025_08_21_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_21_ip_address_idx ON public.traffic_logs_2025_08_21 USING btree (ip_address);


--
-- Name: traffic_logs_2025_08_21_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_21_visitor_id_idx ON public.traffic_logs_2025_08_21 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_08_22_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_22_campaign_id_idx ON public.traffic_logs_2025_08_22 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_08_22_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_22_created_at_idx ON public.traffic_logs_2025_08_22 USING btree (created_at);


--
-- Name: traffic_logs_2025_08_22_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_22_ip_address_idx ON public.traffic_logs_2025_08_22 USING btree (ip_address);


--
-- Name: traffic_logs_2025_08_22_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_22_visitor_id_idx ON public.traffic_logs_2025_08_22 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_08_23_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_23_campaign_id_idx ON public.traffic_logs_2025_08_23 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_08_23_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_23_created_at_idx ON public.traffic_logs_2025_08_23 USING btree (created_at);


--
-- Name: traffic_logs_2025_08_23_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_23_ip_address_idx ON public.traffic_logs_2025_08_23 USING btree (ip_address);


--
-- Name: traffic_logs_2025_08_23_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_23_visitor_id_idx ON public.traffic_logs_2025_08_23 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_08_24_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_24_campaign_id_idx ON public.traffic_logs_2025_08_24 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_08_24_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_24_created_at_idx ON public.traffic_logs_2025_08_24 USING btree (created_at);


--
-- Name: traffic_logs_2025_08_24_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_24_ip_address_idx ON public.traffic_logs_2025_08_24 USING btree (ip_address);


--
-- Name: traffic_logs_2025_08_24_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_24_visitor_id_idx ON public.traffic_logs_2025_08_24 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_08_25_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_25_campaign_id_idx ON public.traffic_logs_2025_08_25 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_08_25_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_25_created_at_idx ON public.traffic_logs_2025_08_25 USING btree (created_at);


--
-- Name: traffic_logs_2025_08_25_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_25_ip_address_idx ON public.traffic_logs_2025_08_25 USING btree (ip_address);


--
-- Name: traffic_logs_2025_08_25_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_25_visitor_id_idx ON public.traffic_logs_2025_08_25 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_08_26_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_26_campaign_id_idx ON public.traffic_logs_2025_08_26 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_08_26_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_26_created_at_idx ON public.traffic_logs_2025_08_26 USING btree (created_at);


--
-- Name: traffic_logs_2025_08_26_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_26_ip_address_idx ON public.traffic_logs_2025_08_26 USING btree (ip_address);


--
-- Name: traffic_logs_2025_08_26_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_26_visitor_id_idx ON public.traffic_logs_2025_08_26 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_08_27_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_27_campaign_id_idx ON public.traffic_logs_2025_08_27 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_08_27_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_27_created_at_idx ON public.traffic_logs_2025_08_27 USING btree (created_at);


--
-- Name: traffic_logs_2025_08_27_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_27_ip_address_idx ON public.traffic_logs_2025_08_27 USING btree (ip_address);


--
-- Name: traffic_logs_2025_08_27_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_27_visitor_id_idx ON public.traffic_logs_2025_08_27 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_08_28_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_28_campaign_id_idx ON public.traffic_logs_2025_08_28 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_08_28_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_28_created_at_idx ON public.traffic_logs_2025_08_28 USING btree (created_at);


--
-- Name: traffic_logs_2025_08_28_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_28_ip_address_idx ON public.traffic_logs_2025_08_28 USING btree (ip_address);


--
-- Name: traffic_logs_2025_08_28_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_28_visitor_id_idx ON public.traffic_logs_2025_08_28 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_08_29_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_29_campaign_id_idx ON public.traffic_logs_2025_08_29 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_08_29_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_29_created_at_idx ON public.traffic_logs_2025_08_29 USING btree (created_at);


--
-- Name: traffic_logs_2025_08_29_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_29_ip_address_idx ON public.traffic_logs_2025_08_29 USING btree (ip_address);


--
-- Name: traffic_logs_2025_08_29_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_29_visitor_id_idx ON public.traffic_logs_2025_08_29 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_08_30_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_30_campaign_id_idx ON public.traffic_logs_2025_08_30 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_08_30_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_30_created_at_idx ON public.traffic_logs_2025_08_30 USING btree (created_at);


--
-- Name: traffic_logs_2025_08_30_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_30_ip_address_idx ON public.traffic_logs_2025_08_30 USING btree (ip_address);


--
-- Name: traffic_logs_2025_08_30_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_30_visitor_id_idx ON public.traffic_logs_2025_08_30 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_08_31_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_31_campaign_id_idx ON public.traffic_logs_2025_08_31 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_08_31_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_31_created_at_idx ON public.traffic_logs_2025_08_31 USING btree (created_at);


--
-- Name: traffic_logs_2025_08_31_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_31_ip_address_idx ON public.traffic_logs_2025_08_31 USING btree (ip_address);


--
-- Name: traffic_logs_2025_08_31_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_08_31_visitor_id_idx ON public.traffic_logs_2025_08_31 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_01_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_01_campaign_id_idx ON public.traffic_logs_2025_09_01 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_01_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_01_created_at_idx ON public.traffic_logs_2025_09_01 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_01_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_01_ip_address_idx ON public.traffic_logs_2025_09_01 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_01_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_01_visitor_id_idx ON public.traffic_logs_2025_09_01 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_02_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_02_campaign_id_idx ON public.traffic_logs_2025_09_02 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_02_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_02_created_at_idx ON public.traffic_logs_2025_09_02 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_02_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_02_ip_address_idx ON public.traffic_logs_2025_09_02 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_02_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_02_visitor_id_idx ON public.traffic_logs_2025_09_02 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_03_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_03_campaign_id_idx ON public.traffic_logs_2025_09_03 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_03_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_03_created_at_idx ON public.traffic_logs_2025_09_03 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_03_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_03_ip_address_idx ON public.traffic_logs_2025_09_03 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_03_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_03_visitor_id_idx ON public.traffic_logs_2025_09_03 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_04_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_04_campaign_id_idx ON public.traffic_logs_2025_09_04 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_04_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_04_created_at_idx ON public.traffic_logs_2025_09_04 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_04_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_04_ip_address_idx ON public.traffic_logs_2025_09_04 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_04_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_04_visitor_id_idx ON public.traffic_logs_2025_09_04 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_05_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_05_campaign_id_idx ON public.traffic_logs_2025_09_05 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_05_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_05_created_at_idx ON public.traffic_logs_2025_09_05 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_05_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_05_ip_address_idx ON public.traffic_logs_2025_09_05 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_05_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_05_visitor_id_idx ON public.traffic_logs_2025_09_05 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_06_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_06_campaign_id_idx ON public.traffic_logs_2025_09_06 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_06_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_06_created_at_idx ON public.traffic_logs_2025_09_06 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_06_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_06_ip_address_idx ON public.traffic_logs_2025_09_06 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_06_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_06_visitor_id_idx ON public.traffic_logs_2025_09_06 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_07_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_07_campaign_id_idx ON public.traffic_logs_2025_09_07 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_07_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_07_created_at_idx ON public.traffic_logs_2025_09_07 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_07_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_07_ip_address_idx ON public.traffic_logs_2025_09_07 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_07_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_07_visitor_id_idx ON public.traffic_logs_2025_09_07 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_08_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_08_campaign_id_idx ON public.traffic_logs_2025_09_08 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_08_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_08_created_at_idx ON public.traffic_logs_2025_09_08 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_08_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_08_ip_address_idx ON public.traffic_logs_2025_09_08 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_08_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_08_visitor_id_idx ON public.traffic_logs_2025_09_08 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_09_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_09_campaign_id_idx ON public.traffic_logs_2025_09_09 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_09_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_09_created_at_idx ON public.traffic_logs_2025_09_09 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_09_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_09_ip_address_idx ON public.traffic_logs_2025_09_09 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_09_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_09_visitor_id_idx ON public.traffic_logs_2025_09_09 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_10_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_10_campaign_id_idx ON public.traffic_logs_2025_09_10 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_10_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_10_created_at_idx ON public.traffic_logs_2025_09_10 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_10_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_10_ip_address_idx ON public.traffic_logs_2025_09_10 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_10_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_10_visitor_id_idx ON public.traffic_logs_2025_09_10 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_11_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_11_campaign_id_idx ON public.traffic_logs_2025_09_11 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_11_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_11_created_at_idx ON public.traffic_logs_2025_09_11 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_11_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_11_ip_address_idx ON public.traffic_logs_2025_09_11 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_11_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_11_visitor_id_idx ON public.traffic_logs_2025_09_11 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_12_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_12_campaign_id_idx ON public.traffic_logs_2025_09_12 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_12_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_12_created_at_idx ON public.traffic_logs_2025_09_12 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_12_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_12_ip_address_idx ON public.traffic_logs_2025_09_12 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_12_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_12_visitor_id_idx ON public.traffic_logs_2025_09_12 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_13_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_13_campaign_id_idx ON public.traffic_logs_2025_09_13 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_13_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_13_created_at_idx ON public.traffic_logs_2025_09_13 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_13_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_13_ip_address_idx ON public.traffic_logs_2025_09_13 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_13_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_13_visitor_id_idx ON public.traffic_logs_2025_09_13 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_14_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_14_campaign_id_idx ON public.traffic_logs_2025_09_14 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_14_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_14_created_at_idx ON public.traffic_logs_2025_09_14 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_14_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_14_ip_address_idx ON public.traffic_logs_2025_09_14 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_14_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_14_visitor_id_idx ON public.traffic_logs_2025_09_14 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_15_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_15_campaign_id_idx ON public.traffic_logs_2025_09_15 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_15_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_15_created_at_idx ON public.traffic_logs_2025_09_15 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_15_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_15_ip_address_idx ON public.traffic_logs_2025_09_15 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_15_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_15_visitor_id_idx ON public.traffic_logs_2025_09_15 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_16_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_16_campaign_id_idx ON public.traffic_logs_2025_09_16 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_16_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_16_created_at_idx ON public.traffic_logs_2025_09_16 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_16_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_16_ip_address_idx ON public.traffic_logs_2025_09_16 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_16_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_16_visitor_id_idx ON public.traffic_logs_2025_09_16 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_17_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_17_campaign_id_idx ON public.traffic_logs_2025_09_17 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_17_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_17_created_at_idx ON public.traffic_logs_2025_09_17 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_17_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_17_ip_address_idx ON public.traffic_logs_2025_09_17 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_17_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_17_visitor_id_idx ON public.traffic_logs_2025_09_17 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_18_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_18_campaign_id_idx ON public.traffic_logs_2025_09_18 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_18_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_18_created_at_idx ON public.traffic_logs_2025_09_18 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_18_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_18_ip_address_idx ON public.traffic_logs_2025_09_18 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_18_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_18_visitor_id_idx ON public.traffic_logs_2025_09_18 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_09_19_campaign_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_19_campaign_id_idx ON public.traffic_logs_2025_09_19 USING btree (campaign_id);


--
-- Name: traffic_logs_2025_09_19_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_19_created_at_idx ON public.traffic_logs_2025_09_19 USING btree (created_at);


--
-- Name: traffic_logs_2025_09_19_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_19_ip_address_idx ON public.traffic_logs_2025_09_19 USING btree (ip_address);


--
-- Name: traffic_logs_2025_09_19_visitor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX traffic_logs_2025_09_19_visitor_id_idx ON public.traffic_logs_2025_09_19 USING btree (visitor_id);


--
-- Name: traffic_logs_2025_08_21_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_08_21_campaign_id_idx;


--
-- Name: traffic_logs_2025_08_21_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_08_21_created_at_idx;


--
-- Name: traffic_logs_2025_08_21_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_08_21_ip_address_idx;


--
-- Name: traffic_logs_2025_08_21_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_08_21_pkey;


--
-- Name: traffic_logs_2025_08_21_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_08_21_visitor_id_idx;


--
-- Name: traffic_logs_2025_08_22_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_08_22_campaign_id_idx;


--
-- Name: traffic_logs_2025_08_22_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_08_22_created_at_idx;


--
-- Name: traffic_logs_2025_08_22_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_08_22_ip_address_idx;


--
-- Name: traffic_logs_2025_08_22_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_08_22_pkey;


--
-- Name: traffic_logs_2025_08_22_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_08_22_visitor_id_idx;


--
-- Name: traffic_logs_2025_08_23_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_08_23_campaign_id_idx;


--
-- Name: traffic_logs_2025_08_23_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_08_23_created_at_idx;


--
-- Name: traffic_logs_2025_08_23_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_08_23_ip_address_idx;


--
-- Name: traffic_logs_2025_08_23_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_08_23_pkey;


--
-- Name: traffic_logs_2025_08_23_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_08_23_visitor_id_idx;


--
-- Name: traffic_logs_2025_08_24_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_08_24_campaign_id_idx;


--
-- Name: traffic_logs_2025_08_24_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_08_24_created_at_idx;


--
-- Name: traffic_logs_2025_08_24_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_08_24_ip_address_idx;


--
-- Name: traffic_logs_2025_08_24_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_08_24_pkey;


--
-- Name: traffic_logs_2025_08_24_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_08_24_visitor_id_idx;


--
-- Name: traffic_logs_2025_08_25_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_08_25_campaign_id_idx;


--
-- Name: traffic_logs_2025_08_25_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_08_25_created_at_idx;


--
-- Name: traffic_logs_2025_08_25_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_08_25_ip_address_idx;


--
-- Name: traffic_logs_2025_08_25_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_08_25_pkey;


--
-- Name: traffic_logs_2025_08_25_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_08_25_visitor_id_idx;


--
-- Name: traffic_logs_2025_08_26_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_08_26_campaign_id_idx;


--
-- Name: traffic_logs_2025_08_26_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_08_26_created_at_idx;


--
-- Name: traffic_logs_2025_08_26_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_08_26_ip_address_idx;


--
-- Name: traffic_logs_2025_08_26_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_08_26_pkey;


--
-- Name: traffic_logs_2025_08_26_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_08_26_visitor_id_idx;


--
-- Name: traffic_logs_2025_08_27_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_08_27_campaign_id_idx;


--
-- Name: traffic_logs_2025_08_27_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_08_27_created_at_idx;


--
-- Name: traffic_logs_2025_08_27_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_08_27_ip_address_idx;


--
-- Name: traffic_logs_2025_08_27_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_08_27_pkey;


--
-- Name: traffic_logs_2025_08_27_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_08_27_visitor_id_idx;


--
-- Name: traffic_logs_2025_08_28_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_08_28_campaign_id_idx;


--
-- Name: traffic_logs_2025_08_28_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_08_28_created_at_idx;


--
-- Name: traffic_logs_2025_08_28_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_08_28_ip_address_idx;


--
-- Name: traffic_logs_2025_08_28_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_08_28_pkey;


--
-- Name: traffic_logs_2025_08_28_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_08_28_visitor_id_idx;


--
-- Name: traffic_logs_2025_08_29_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_08_29_campaign_id_idx;


--
-- Name: traffic_logs_2025_08_29_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_08_29_created_at_idx;


--
-- Name: traffic_logs_2025_08_29_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_08_29_ip_address_idx;


--
-- Name: traffic_logs_2025_08_29_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_08_29_pkey;


--
-- Name: traffic_logs_2025_08_29_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_08_29_visitor_id_idx;


--
-- Name: traffic_logs_2025_08_30_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_08_30_campaign_id_idx;


--
-- Name: traffic_logs_2025_08_30_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_08_30_created_at_idx;


--
-- Name: traffic_logs_2025_08_30_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_08_30_ip_address_idx;


--
-- Name: traffic_logs_2025_08_30_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_08_30_pkey;


--
-- Name: traffic_logs_2025_08_30_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_08_30_visitor_id_idx;


--
-- Name: traffic_logs_2025_08_31_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_08_31_campaign_id_idx;


--
-- Name: traffic_logs_2025_08_31_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_08_31_created_at_idx;


--
-- Name: traffic_logs_2025_08_31_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_08_31_ip_address_idx;


--
-- Name: traffic_logs_2025_08_31_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_08_31_pkey;


--
-- Name: traffic_logs_2025_08_31_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_08_31_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_01_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_01_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_01_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_01_created_at_idx;


--
-- Name: traffic_logs_2025_09_01_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_01_ip_address_idx;


--
-- Name: traffic_logs_2025_09_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_01_pkey;


--
-- Name: traffic_logs_2025_09_01_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_01_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_02_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_02_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_02_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_02_created_at_idx;


--
-- Name: traffic_logs_2025_09_02_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_02_ip_address_idx;


--
-- Name: traffic_logs_2025_09_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_02_pkey;


--
-- Name: traffic_logs_2025_09_02_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_02_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_03_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_03_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_03_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_03_created_at_idx;


--
-- Name: traffic_logs_2025_09_03_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_03_ip_address_idx;


--
-- Name: traffic_logs_2025_09_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_03_pkey;


--
-- Name: traffic_logs_2025_09_03_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_03_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_04_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_04_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_04_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_04_created_at_idx;


--
-- Name: traffic_logs_2025_09_04_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_04_ip_address_idx;


--
-- Name: traffic_logs_2025_09_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_04_pkey;


--
-- Name: traffic_logs_2025_09_04_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_04_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_05_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_05_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_05_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_05_created_at_idx;


--
-- Name: traffic_logs_2025_09_05_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_05_ip_address_idx;


--
-- Name: traffic_logs_2025_09_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_05_pkey;


--
-- Name: traffic_logs_2025_09_05_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_05_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_06_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_06_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_06_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_06_created_at_idx;


--
-- Name: traffic_logs_2025_09_06_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_06_ip_address_idx;


--
-- Name: traffic_logs_2025_09_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_06_pkey;


--
-- Name: traffic_logs_2025_09_06_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_06_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_07_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_07_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_07_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_07_created_at_idx;


--
-- Name: traffic_logs_2025_09_07_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_07_ip_address_idx;


--
-- Name: traffic_logs_2025_09_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_07_pkey;


--
-- Name: traffic_logs_2025_09_07_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_07_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_08_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_08_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_08_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_08_created_at_idx;


--
-- Name: traffic_logs_2025_09_08_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_08_ip_address_idx;


--
-- Name: traffic_logs_2025_09_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_08_pkey;


--
-- Name: traffic_logs_2025_09_08_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_08_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_09_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_09_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_09_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_09_created_at_idx;


--
-- Name: traffic_logs_2025_09_09_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_09_ip_address_idx;


--
-- Name: traffic_logs_2025_09_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_09_pkey;


--
-- Name: traffic_logs_2025_09_09_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_09_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_10_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_10_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_10_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_10_created_at_idx;


--
-- Name: traffic_logs_2025_09_10_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_10_ip_address_idx;


--
-- Name: traffic_logs_2025_09_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_10_pkey;


--
-- Name: traffic_logs_2025_09_10_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_10_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_11_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_11_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_11_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_11_created_at_idx;


--
-- Name: traffic_logs_2025_09_11_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_11_ip_address_idx;


--
-- Name: traffic_logs_2025_09_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_11_pkey;


--
-- Name: traffic_logs_2025_09_11_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_11_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_12_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_12_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_12_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_12_created_at_idx;


--
-- Name: traffic_logs_2025_09_12_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_12_ip_address_idx;


--
-- Name: traffic_logs_2025_09_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_12_pkey;


--
-- Name: traffic_logs_2025_09_12_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_12_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_13_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_13_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_13_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_13_created_at_idx;


--
-- Name: traffic_logs_2025_09_13_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_13_ip_address_idx;


--
-- Name: traffic_logs_2025_09_13_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_13_pkey;


--
-- Name: traffic_logs_2025_09_13_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_13_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_14_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_14_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_14_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_14_created_at_idx;


--
-- Name: traffic_logs_2025_09_14_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_14_ip_address_idx;


--
-- Name: traffic_logs_2025_09_14_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_14_pkey;


--
-- Name: traffic_logs_2025_09_14_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_14_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_15_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_15_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_15_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_15_created_at_idx;


--
-- Name: traffic_logs_2025_09_15_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_15_ip_address_idx;


--
-- Name: traffic_logs_2025_09_15_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_15_pkey;


--
-- Name: traffic_logs_2025_09_15_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_15_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_16_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_16_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_16_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_16_created_at_idx;


--
-- Name: traffic_logs_2025_09_16_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_16_ip_address_idx;


--
-- Name: traffic_logs_2025_09_16_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_16_pkey;


--
-- Name: traffic_logs_2025_09_16_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_16_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_17_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_17_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_17_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_17_created_at_idx;


--
-- Name: traffic_logs_2025_09_17_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_17_ip_address_idx;


--
-- Name: traffic_logs_2025_09_17_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_17_pkey;


--
-- Name: traffic_logs_2025_09_17_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_17_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_18_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_18_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_18_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_18_created_at_idx;


--
-- Name: traffic_logs_2025_09_18_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_18_ip_address_idx;


--
-- Name: traffic_logs_2025_09_18_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_18_pkey;


--
-- Name: traffic_logs_2025_09_18_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_18_visitor_id_idx;


--
-- Name: traffic_logs_2025_09_19_campaign_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_campaign_id ATTACH PARTITION public.traffic_logs_2025_09_19_campaign_id_idx;


--
-- Name: traffic_logs_2025_09_19_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_created_at ATTACH PARTITION public.traffic_logs_2025_09_19_created_at_idx;


--
-- Name: traffic_logs_2025_09_19_ip_address_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_ip_address ATTACH PARTITION public.traffic_logs_2025_09_19_ip_address_idx;


--
-- Name: traffic_logs_2025_09_19_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.traffic_logs_pkey ATTACH PARTITION public.traffic_logs_2025_09_19_pkey;


--
-- Name: traffic_logs_2025_09_19_visitor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_traffic_logs_visitor_id ATTACH PARTITION public.traffic_logs_2025_09_19_visitor_id_idx;


--
-- Name: _materialized_hypertable_5 ts_insert_blocker; Type: TRIGGER; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TRIGGER ts_insert_blocker BEFORE INSERT ON _timescaledb_internal._materialized_hypertable_5 FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.insert_blocker();


--
-- Name: metrics ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON public.metrics FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('1');


--
-- Name: metrics ts_insert_blocker; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ts_insert_blocker BEFORE INSERT ON public.metrics FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.insert_blocker();


--
-- Name: stats_1d ts_insert_blocker; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ts_insert_blocker BEFORE INSERT ON public.stats_1d FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.insert_blocker();


--
-- Name: stats_1h ts_insert_blocker; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ts_insert_blocker BEFORE INSERT ON public.stats_1h FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.insert_blocker();


--
-- Name: stats_1m ts_insert_blocker; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ts_insert_blocker BEFORE INSERT ON public.stats_1m FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.insert_blocker();


--
-- Name: campaigns update_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: configurations update_configurations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_configurations_updated_at BEFORE UPDATE ON public.configurations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ip_blacklist update_ip_blacklist_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_ip_blacklist_updated_at BEFORE UPDATE ON public.ip_blacklist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ip_reputation update_ip_reputation_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_ip_reputation_updated_at BEFORE UPDATE ON public.ip_reputation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: streams update_streams_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_streams_updated_at BEFORE UPDATE ON public.streams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: blacklist_events blacklist_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blacklist_events
    ADD CONSTRAINT blacklist_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: blacklist_events blacklist_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blacklist_events
    ADD CONSTRAINT blacklist_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: configurations configurations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configurations
    ADD CONSTRAINT configurations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ip_blacklist ip_blacklist_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_blacklist
    ADD CONSTRAINT ip_blacklist_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: ip_blacklist ip_blacklist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_blacklist
    ADD CONSTRAINT ip_blacklist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: streams streams_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.streams
    ADD CONSTRAINT streams_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: targeting_rules targeting_rules_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.targeting_rules
    ADD CONSTRAINT targeting_rules_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.streams(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

