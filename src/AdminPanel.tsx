import React, { useState, useEffect } from 'react';
import { Key, Trash2, Download, RefreshCw, Plus, Calendar, Database } from 'lucide-react';
import { createApiKey, getApiKeys, deleteApiKey, getFilesWithApiKey } from './lib/api';
import { decryptFile } from './lib/encryption';
import toast from 'react-hot-toast';

interface ApiKey {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

interface File {
  id: string;
  name: string;
  content: string;
  mime_type: string;
  size: number;
  created_at: string;
  user_id: string;
}

export default function AdminPanel() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [showAllFiles, setShowAllFiles] = useState(false);

  useEffect(() => {
    loadApiKeys();
  }, []);

  async function loadApiKeys() {
    try {
      setLoading(true);
      const keys = await getApiKeys();
      setApiKeys(keys);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateKey() {
    try {
      setLoading(true);
      const expiryDate = newKeyExpiry ? new Date(newKeyExpiry) : undefined;
      const apiKey = await createApiKey(newKeyName, expiryDate);
      
      toast.success('API ключ создан успешно');
      toast((t) => (
        <div>
          <p className="font-semibold mb-2">Сохраните этот ключ! Он будет показан только один раз:</p>
          <code className="bg-gray-100 p-2 rounded block mb-2 break-all">{apiKey}</code>
          <button
            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
            onClick={() => {
              navigator.clipboard.writeText(apiKey);
              toast.success('Ключ скопирован');
            }}
          >
            Копировать
          </button>
        </div>
      ), { duration: 20000 });

      setShowNewKeyDialog(false);
      setNewKeyName('');
      setNewKeyExpiry('');
      loadApiKeys();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteKey(id: string) {
    if (!confirm('Вы уверены, что хотите удалить этот API ключ?')) return;
    
    try {
      setLoading(true);
      await deleteApiKey(id);
      toast.success('API ключ удален');
      loadApiKeys();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadAllFiles() {
    try {
      setLoading(true);
      const filesData = await getFilesWithApiKey('admin');
      setFiles(filesData);
      setShowAllFiles(true);
      toast.success('Файлы загружены');
    } catch (error: any) {
      toast.error(error.message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadFile(file: File) {
    try {
      await decryptFile(file.content, file.name, file.mime_type);
      toast.success('Файл успешно скачан');
    } catch (error: any) {
      toast.error('Ошибка при скачивании файла');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* API Keys Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold flex items-center">
              <Key className="h-5 w-5 mr-2" />
              API Ключи
            </h2>
            <div className="flex gap-4">
              <button
                onClick={handleLoadAllFiles}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center"
                disabled={loading}
              >
                <Database className="h-4 w-4 mr-2" />
                Просмотр всех файлов
              </button>
              <button
                onClick={() => setShowNewKeyDialog(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center"
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Создать ключ
              </button>
            </div>
          </div>

          {/* API Keys Dialog */}
          {showNewKeyDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold mb-4">Создание нового API ключа</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Название ключа
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Например: Аналитика файлов"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Срок действия (опционально)
                    </label>
                    <input
                      type="datetime-local"
                      value={newKeyExpiry}
                      onChange={(e) => setNewKeyExpiry(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => setShowNewKeyDialog(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleCreateKey}
                      disabled={!newKeyName || loading}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Создать
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* API Keys List */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Создан
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Последнее использование
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Срок действия
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {apiKeys.map((key) => (
                  <tr key={key.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {key.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(key.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {key.last_used_at
                        ? new Date(key.last_used_at).toLocaleString()
                        : 'Не использовался'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {key.expires_at
                        ? new Date(key.expires_at).toLocaleString()
                        : 'Бессрочный'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleDeleteKey(key.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Удалить ключ"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {apiKeys.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      Нет созданных API ключей
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Files Section */}
        {showAllFiles && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Все файлы пользователей</h2>
              <button
                onClick={() => setShowAllFiles(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                ✕
              </button>
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
                      ID пользователя
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Загружен
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Math.round(file.size / 1024)} КБ
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {file.mime_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {file.user_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(file.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDownloadFile(file)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Скачать файл"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {files.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        Нет доступных файлов
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}