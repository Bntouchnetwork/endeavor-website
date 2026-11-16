-- Live Webinar: vídeo de abertura (gravado no Studio com teleprompter) que toca antes do primeiro slide.
alter table public.lw_webinars add column if not exists intro jsonb;  -- {path, duracao_ms, mime} no bucket meet-media
-- o bucket do Studio passa a aceitar o vídeo de abertura (até 100 MB)
update storage.buckets set file_size_limit = 104857600,
  allowed_mime_types = array['audio/mpeg','audio/webm','audio/ogg','audio/mp4','audio/wav','audio/x-wav','audio/aac','image/png','image/jpeg','image/webp','video/webm','video/mp4']
where id = 'meet-media';
