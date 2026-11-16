-- Video/Reels analysis and landing page scan.
--
-- Video: the browser extracts a few still frames from the video; only those JPEG frames are uploaded
-- (the video file itself never leaves the user's device). Frames live in analysis_assets as
-- kind = 'video_frame'. Video metadata measured in the browser is stored in analyses.video_meta.
--
-- Landing page: the server fetches the URL once (SSRF-guarded); the check report is stored inside
-- analyses.score_breakdown -> 'landing' by complete_analysis (no function change needed).

-- analyses: media type and extra inputs -------------------------------------
alter table public.analyses
  add column media_type text not null default 'image' check (media_type in ('image','video')),
  add column video_meta jsonb check (video_meta is null or jsonb_typeof(video_meta) = 'object'),
  add column transcript text check (char_length(transcript) <= 3000),
  add column landing_url text check (landing_url is null or (char_length(landing_url) <= 2048 and landing_url ~ '^https?://'));

alter table public.analyses
  add constraint analyses_video_has_meta check (media_type <> 'video' or video_meta is not null);

-- analysis_assets: several frames per analysis -----------------------------
alter table public.analysis_assets
  add column kind text not null default 'creative' check (kind in ('creative','video_frame')),
  add column frame_index smallint check (frame_index between 0 and 11),
  add column frame_time_ms integer check (frame_time_ms >= 0);

alter table public.analysis_assets
  add constraint analysis_assets_frame_fields check (
    (kind = 'creative' and frame_index is null) or (kind = 'video_frame' and frame_index is not null)
  );

create unique index analysis_assets_one_creative_idx on public.analysis_assets (analysis_id) where kind = 'creative';
create unique index analysis_assets_frame_idx on public.analysis_assets (analysis_id, frame_index) where kind = 'video_frame';

-- findings: new fields for transcript, landing page and video ---------------
alter table public.findings drop constraint findings_field_check;
alter table public.findings
  add constraint findings_field_check check (
    field in ('headline','primary_text','description','image','general','transcript','landing_page','video')
  );
