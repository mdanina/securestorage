/*
  # Add API access for admin users

  1. New Tables
    - `api_keys`
      - `id` (uuid, primary key)
      - `key` (text, unique) - хэшированный API ключ
      - `name` (text) - описание ключа
      - `admin_id` (uuid) - ID администратора
      - `created_at` (timestamptz)
      - `last_used_at` (timestamptz)
      - `expires_at` (timestamptz)

  2. Security
    - Enable RLS on `api_keys` table
    - Add trigger to verify admin status
    - Add policies for admin users to manage their API keys
    - Add functions for API key verification and file access
*/

-- Create API keys table
CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  admin_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz
);

-- Create function and trigger to verify admin status
CREATE OR REPLACE FUNCTION check_admin_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = NEW.admin_id AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'User is not an admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_admin_status
  BEFORE INSERT OR UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION check_admin_status();

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- API keys policies
CREATE POLICY "Admins can manage their API keys"
  ON api_keys FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
      AND id = admin_id
    )
  );

-- Create function to verify API key
CREATE OR REPLACE FUNCTION verify_api_key(api_key text)
RETURNS uuid AS $$
DECLARE
  key_admin_id uuid;
BEGIN
  -- Update last_used_at and get admin_id
  UPDATE api_keys
  SET last_used_at = now()
  WHERE key = api_key
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING admin_id INTO key_admin_id;
  
  RETURN key_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create API endpoints
CREATE OR REPLACE FUNCTION get_files_for_analysis(api_key text)
RETURNS TABLE (
  id uuid,
  name text,
  content text,
  mime_type text,
  size bigint,
  created_at timestamptz,
  user_id uuid
) AS $$
DECLARE
  admin_id uuid;
BEGIN
  -- Verify API key and get admin id
  admin_id := verify_api_key(api_key);
  
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired API key';
  END IF;

  -- Check if the user is still an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = admin_id AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'User is not an admin';
  END IF;

  -- Return files
  RETURN QUERY
  SELECT f.id, f.name, f.content, f.mime_type, f.size, f.created_at, f.user_id
  FROM files f;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;