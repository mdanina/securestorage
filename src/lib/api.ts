import { supabase, supabaseQuery } from './supabase';
import SHA256 from 'crypto-js/sha256';

interface ApiKey {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

// Функция для создания нового API ключа
export async function createApiKey(name: string, expiresAt?: Date): Promise<string> {
  try {
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error('Ошибка аутентификации');
    if (!session.session) throw new Error('Необходима авторизация');

    // Проверяем, является ли пользователь администратором
    const profile = await supabaseQuery(() =>
      supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.session!.user.id)
        .single()
    );

    if (!profile?.is_admin) throw new Error('Недостаточно прав');

    // Генерируем случайный ключ
    const rawKey = crypto.randomUUID() + crypto.randomUUID();
    // Хэшируем ключ для хранения
    const hashedKey = SHA256(rawKey).toString();

    await supabaseQuery(() =>
      supabase
        .from('api_keys')
        .insert({
          key: hashedKey,
          name,
          admin_id: session.session!.user.id,
          expires_at: expiresAt?.toISOString()
        })
    );

    return rawKey;
  } catch (error: any) {
    console.error('Error in createApiKey:', error);
    throw new Error(error.message || 'Не удалось создать API ключ');
  }
}

// Функция для получения списка API ключей
export async function getApiKeys(): Promise<ApiKey[]> {
  try {
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error('Ошибка аутентификации');
    if (!session.session) throw new Error('Необходима авторизация');

    // Проверяем, является ли пользователь администратором
    const profile = await supabaseQuery(() =>
      supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.session!.user.id)
        .single()
    );

    if (!profile?.is_admin) throw new Error('Недостаточно прав');

    const keys = await supabaseQuery(() =>
      supabase
        .from('api_keys')
        .select('id, name, created_at, last_used_at, expires_at')
        .eq('admin_id', session.session!.user.id)
        .order('created_at', { ascending: false })
    );

    return keys || [];
  } catch (error: any) {
    console.error('Error in getApiKeys:', error);
    throw new Error(error.message || 'Не удалось получить список API ключей');
  }
}

// Функция для удаления API ключа
export async function deleteApiKey(id: string): Promise<void> {
  try {
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error('Ошибка аутентификации');
    if (!session.session) throw new Error('Необходима авторизация');

    // Проверяем, является ли пользователь администратором
    const profile = await supabaseQuery(() =>
      supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.session!.user.id)
        .single()
    );

    if (!profile?.is_admin) throw new Error('Недостаточно прав');

    await supabaseQuery(() =>
      supabase
        .from('api_keys')
        .delete()
        .eq('id', id)
        .eq('admin_id', session.session!.user.id)
    );
  } catch (error: any) {
    console.error('Error in deleteApiKey:', error);
    throw new Error(error.message || 'Не удалось удалить API ключ');
  }
}

// Функция для получения файлов через API
export async function getFilesWithApiKey(apiKey: string) {
  try {
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error('Ошибка аутентификации');
    if (!session.session) throw new Error('Необходима авторизация');

    // Проверяем, является ли пользователь администратором
    const profile = await supabaseQuery(() =>
      supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.session!.user.id)
        .single()
    );

    if (!profile?.is_admin) throw new Error('Недостаточно прав');

    const files = await supabaseQuery(() =>
      supabase
        .from('files')
        .select('*')
        .order('created_at', { ascending: false })
    );

    return files || [];
  } catch (error: any) {
    console.error('Error in getFilesWithApiKey:', error);
    throw new Error(error.message || 'Не удалось получить файлы');
  }
}