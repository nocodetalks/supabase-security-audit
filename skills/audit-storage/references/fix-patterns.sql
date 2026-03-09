-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = '<bucket_name>';

-- Add size and MIME limits
UPDATE storage.buckets
SET file_size_limit = 5242880,  -- 5MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = '<bucket_name>';

-- User-scoped storage policy (files in user_id/ folder)
CREATE POLICY "Users access own files" ON storage.objects
    FOR ALL USING (
        bucket_id = '<bucket_name>'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Public read, authenticated upload
CREATE POLICY "Anyone can view" ON storage.objects
    FOR SELECT USING (bucket_id = '<bucket_name>');
CREATE POLICY "Auth users can upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = '<bucket_name>' AND auth.role() = 'authenticated'
    );
