/*
  # Create files and profiles tables

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key) - matches auth.users id
      - `email` (text)
      - `is_admin` (boolean)
      - `created_at` (timestamp)
    
    - `files`
      - `id` (uuid, primary key)
      - `name` (text) - original filename
      - `content` (text) - encrypted file content
      - `size` (bigint) - file size in bytes
      - `mime_type` (text) - file type
      - `user_id` (uuid) - reference to profiles
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for user access
    - Add policies for admin access
*/

-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create files table
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL,
  size bigint NOT NULL,
  mime_type text NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Files policies
CREATE POLICY "Users can manage own files"
  ON files FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all files"
  ON files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );