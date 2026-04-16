-- ================================================================
-- MIGRACIÓN: Soporte de reacciones en chat + avatares en perfiles
-- ================================================================

-- 1. Añadir columna de reacción a los mensajes del chat
ALTER TABLE chat_especialista_admin
  ADD COLUMN IF NOT EXISTS reaction TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;

-- 2. Asegurarse de que la columna avatar_url existe en profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- 3. Bucket en Supabase Storage:
--    Asegúrate de que el bucket "chat-files" existe y tiene la carpeta
--    "avatars/" con acceso público de lectura.
--    Puedes hacerlo desde el dashboard de Supabase:
--    Storage → chat-files → Policies → Allow public read

-- 4. Policy de acceso (ejecutar en el SQL editor de Supabase si es necesario):
-- CREATE POLICY "Avatar público lectura"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'chat-files' AND name LIKE 'avatars/%');

-- CREATE POLICY "Avatar subida autenticada"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (bucket_id = 'chat-files' AND name LIKE 'avatars/%');

-- CREATE POLICY "Avatar actualización propia"
--   ON storage.objects FOR UPDATE
--   TO authenticated
--   USING (bucket_id = 'chat-files' AND name LIKE 'avatars/%');
