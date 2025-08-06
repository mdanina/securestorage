/*
  # Fix profile policies to allow profile creation

  1. Changes
    - Add policy to allow users to insert their own profile
    - Update existing policies for better security

  2. Security
    - Enable RLS on profiles table
    - Add policies for profile management
    - Ensure users can only manage their own profiles
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create new policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;