import React, { useEffect, useState } from 'react';
import { Upload, Trash2, LogOut, Database, Download } from 'lucide-react';
import { supabase, initializeSupabase, getConnectionStatus } from './lib/supabase';
import { encryptFile, decryptFile } from './lib/encryption';
import toast, { Toaster } from 'react-hot-toast';
import AdminPanel from './AdminPanel';

interface File {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  created_at: string;
  content: string;
}

interface Profile {
  id: string;
  email: string;
  is_admin: boolean;
}

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        setIsConnecting(true);
        await initializeSupabase();
        await checkUser();
      } catch (error: any) {
        console.error('Initialization error:', error);
        const status = getConnectionStatus();
        const errorMessage = status.lastError || 'Unknown error occurred';
        toast.error(`Ошибка подключения: ${errorMessage}. Пожалуйста, попробуйте позже.`);
      } finally {
        setIsConnecting(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    const reconnectInterval = setInterval(async () => {
      const status = getConnectionStatus();
      if (!status.isConnected && !isConnecting) {
        try {
          await initializeSupabase();
          await checkUser();
          toast.success('Подключение восстановлено');
        } catch (error) {
          console.error('Reconnection failed:', error);
        }
      }
    }, 30000); // Try to reconnect every 30 seconds

    return () => clearInterval(reconnectInterval);
  }, [isConnecting]);

  useEffect(() => {
    if (profile && !profile.is_admin) {
      fetchFiles();
    }
  }, [profile]);

  async function createProfile(userId: string, userEmail: string) {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (existingProfile) {
        return existingProfile;
      }

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail,
          is_admin: false
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating profile:', insertError);
        throw insertError;
      }

      return newProfile;
    } catch (error) {
      console.error('Error in createProfile:', error);
      throw error;
    }
  }

  async function checkUser() {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (profileData) {
        setProfile(profileData);
      } else {
        try {
          const newProfile = await createProfile(session.user.id, session.user.email!);
          setProfile(newProfile);
        } catch (createError) {
          console.error('Error creating new profile:', createError);
          toast.error('Ошибка создания профиля');
        }
      }
    } catch (error) {
      console.error('Error in checkUser:', error);
      toast.error('Ошибка проверки пользователя');
    } finally {
      setLoading(false);
    }
  }

  async function fetchFiles() {
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Ошибка загрузки файлов');
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    try {
      setUploadLoading(true);
      const encryptedContent = await encryptFile(file);
      
      const { error } = await supabase.from('files').insert({
        name: file.name,
        content: encryptedContent,
        size: file.size,
        mime_type: file.type,
        user_id: profile.id
      });

      if (error) throw error;
      
      toast.success('Файл успешно загружен');
      fetchFiles();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(error.message || 'Ошибка загрузки файла');
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleDownload(file: File) {
    try {
      const { data, error } = await supabase
        .from('files')
        .select('content')
        .eq('id', file.id)
        .single();

      if (error) throw error;
      if (!data?.content) throw new Error('File content not found');

      await decryptFile(data.content, file.name, file.mime_type);
      toast.success('Файл успешно скачан');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Ошибка при скачивании файла');
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Файл удален');
      setFiles(files.filter(file => file.id !== id));
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Ошибка удаления файла');
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (authLoading) return;

    try {
      setAuthLoading(true);
      
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              email: email
            }
          }
        });
        
        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            toast.error('Этот email уже зарегистрирован. Пожалуйста, войдите в систему.');
            setIsSignUp(false);
          } else {
            throw signUpError;
          }
          return;
        }

        if (data.user) {
          try {
            await createProfile(data.user.id, data.user.email!);
            toast.success('Регистрация успешна! Теперь вы можете войти.');
            setIsSignUp(false);
          } catch (profileError) {
            console.error('Error creating profile during signup:', profileError);
            toast.error('Ошибка создания профиля');
          }
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            toast.error('Неверный email или пароль');
          } else {
            throw signInError;
          }
          return;
        }

        if (data.user) {
          toast.success('Вход выполнен успешно');
          await checkUser();
        }
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      toast.error(isSignUp ? 'Ошибка регистрации' : 'Ошибка входа');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (resetLoading) return;

    try {
      setResetLoading(true);
      const siteUrl = window.location.origin.includes('localhost') 
        ? 'https://silly-biscuit-6012f5.netlify.app'
        : window.location.origin;

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${siteUrl}/reset-password`
      });

      if (error) throw error;

      toast.success('Инструкции по восстановлению пароля отправлены на ваш email');
      setIsResetPassword(false);
      setResetEmail('');
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error('Ошибка при отправке инструкций по восстановлению пароля');
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setProfile(null);
      setFiles([]);
      toast.success('Выход выполнен успешно');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Ошибка при выходе из системы');
    }
  }

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Подключение к базе данных...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="flex items-center justify-center mb-8">
            <Database className="h-8 w-8 text-gray-900" />
            <h1 className="text-2xl font-bold ml-2">База данных психологических сессий</h1>
          </div>
          
          {isResetPassword ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700">
                  Email для восстановления пароля
                </label>
                <input
                  type="email"
                  id="resetEmail"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  disabled={resetLoading}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Отправка инструкций...
                  </span>
                ) : (
                  'Отправить инструкции'
                )}
              </button>

              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    setIsResetPassword(false);
                    setResetEmail('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                  disabled={resetLoading}
                >
                  Вернуться к входу
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  disabled={authLoading}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Пароль
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  disabled={authLoading}
                  minLength={6}
                />
                {isSignUp && (
                  <p className="mt-1 text-sm text-gray-500">
                    Пароль должен содержать минимум 6 символов
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={authLoading}
              >
                {authLoading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {isSignUp ? 'Регистрация...' : 'Вход...'}
                  </span>
                ) : (
                  isSignUp ? 'Зарегистрироваться' : 'Войти'
                )}
              </button>

              <div className="mt-4 text-center space-y-2">
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setEmail('');
                    setPassword('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 block w-full"
                  disabled={authLoading}
                >
                  {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                </button>

                {!isSignUp && (
                  <button
                    onClick={() => {
                      setIsResetPassword(true);
                      setEmail('');
                      setPassword('');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 block w-full"
                    disabled={authLoading}
                  >
                    Забыли пароль?
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (profile.is_admin) {
    return (
      <>
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Database className="h-6 w-6 text-gray-900" />
                <span className="ml-2 text-xl font-semibold">Админ-панель</span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {profile.email} (Администратор)
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-gray-600 hover:text-gray-900"
                  title="Выйти"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </nav>
        <AdminPanel />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Database className="h-6 w-6 text-gray-900" />
              <span className="ml-2 text-xl font-semibold">База данных психологических сессий</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{profile.email}</span>
              <button
                onClick={handleSignOut}
                className="text-gray-600 hover:text-gray-900"
                title="Выйти"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Ваши файлы</h2>
            <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed">
              <Upload className="h-4 w-4 mr-2" />
              Загрузить файл
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadLoading}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Размер
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Тип
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата загрузки
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {files.map((file) => (
                  <tr key={file.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {file.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {Math.round(file.size / 1024)} КБ
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {file.mime_type}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(file.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleDownload(file)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Скачать"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(file.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Удалить"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {files.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      Нет загруженных файлов
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;