/*
  # Comprehensive RLS Policy Update

  1. Changes
    - Drop all existing policies to start fresh
    - Create complete set of policies for profiles and files tables
    - Fix references to auth.users table in policies
    - Ensure proper user_id tracking in files table

  2. Security
    - Enable RLS on both tables
    - Set up proper policies for all operations
    - Ensure data isolation between users
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can manage own files" ON files;
DROP POLICY IF EXISTS "Admin can view all files" ON files;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Files policies
CREATE POLICY "Users can view own files"
  ON files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own files"
  ON files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own files"
  ON files FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own files"
  ON files FOR DELETE
  USING (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admin can view all files"
  ON files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );