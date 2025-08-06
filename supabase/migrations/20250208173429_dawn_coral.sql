/*
  # Update RLS policies to fix recursion issues

  1. Changes
    - Drop existing policies
    - Create new non-recursive policies for profiles and files
  
  2. Security
    - Maintain RLS on both tables
    - Add simplified policies for user access
    - Add non-recursive admin policies
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can manage own files" ON files;
DROP POLICY IF EXISTS "Admin can view all files" ON files;

-- Create new profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create new files policies
CREATE POLICY "Users can manage own files"
  ON files FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all files"
  ON files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id AND
            id IN (SELECT id FROM profiles WHERE is_admin = true)
    )
  );