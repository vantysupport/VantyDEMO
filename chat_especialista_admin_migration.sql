-- Tabla de chat entre especialistas y jefe
CREATE TABLE IF NOT EXISTS chat_especialista_admin (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('especialista', 'terapeuta', 'jefe')),
  sender_name TEXT NOT NULL,
  recipient_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'audio')),
  file_url TEXT DEFAULT NULL,
  file_name TEXT DEFAULT NULL,
  file_type TEXT DEFAULT NULL,
  read_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_especialista_admin(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_recipient ON chat_especialista_admin(recipient_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_especialista_admin(created_at);

-- RLS
ALTER TABLE chat_especialista_admin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "especialistas_ven_sus_mensajes" ON chat_especialista_admin
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "jefe_ve_todos" ON chat_especialista_admin
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'jefe')
  );

CREATE POLICY "insertar_mensajes_propios" ON chat_especialista_admin
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "marcar_leido" ON chat_especialista_admin
  FOR UPDATE USING (
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'jefe')
  );

CREATE POLICY "borrar_propio" ON chat_especialista_admin
  FOR DELETE USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'jefe')
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_especialista_admin;

-- Storage bucket para archivos del chat
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "chat_files_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'chat-files' AND auth.role() = 'authenticated');

CREATE POLICY "chat_files_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-files');
