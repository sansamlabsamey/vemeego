
import React, { useState, useEffect, useRef } from 'react';
import { FileText, MoreHorizontal, Download, Share2, Filter, Upload, Loader2, Trash2, File as FileIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFileUpload } from '../hooks/useFileUpload';
import { supabase } from '../utils/supabase';
import { api } from '../utils/api';

interface FileItem {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: {
    size?: number;
    mimetype?: string;
    owner_name?: string;
    owner_id?: string;
    [key: string]: any;
  };
}

const Files = () => {
  const { user } = useAuth();
  const { uploadFile, uploading } = useFileUpload();
  const [activeTab, setActiveTab] = useState<'shared' | 'personal'>('shared');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.organization_id) {
      fetchFiles();
    }
  }, [user?.organization_id, activeTab]);

  const fetchFiles = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const folder = activeTab === 'shared' ? 'shared' : `personal/${user.id}`;
      const path = `${user.organization_id}/${folder}`;

      // Use backend API to list files
      const { data } = await api.get(`/storage/list/organization-files`, {
        params: { path }
      });

      setFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.organization_id) return;

    try {
      const folder = activeTab === 'shared' ? 'shared' : `personal/${user.id}`;
      const timestamp = new Date().getTime();
      const fileName = `${timestamp}_${file.name}`;
      const path = `${user.organization_id}/${folder}/${fileName}`;

      const { error } = await uploadFile({
        bucketName: 'organization-files',
        path,
        file,
        metadata: {
          owner_name: user.user_name,
          owner_id: user.id,
          original_name: file.name,
        }
      });

      if (error) throw error;
      fetchFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (fileName: string) => {
    if (!user?.organization_id) return;
    
    try {
      const folder = activeTab === 'shared' ? 'shared' : `personal/${user.id}`;
      const path = `${user.organization_id}/${folder}/${fileName}`;

      // Get signed URL from backend
      const { data } = await api.post('/storage/url', {
        bucket: 'organization-files',
        path
      });

      if (data?.signedURL) {
        const a = document.createElement('a');
        a.href = data.signedURL;
        a.download = fileName.split('_').slice(1).join('_'); // Remove timestamp prefix
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full p-4 md:p-8 overflow-y-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Files & Documents</h1>
          <p className="text-slate-500">Manage and share your team's resources.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button 
            onClick={handleUploadClick}
            disabled={uploading}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Upload File
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('shared')}
          className={`pb-3 font-medium text-sm transition-colors relative ${
            activeTab === 'shared' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Organization Shared
          {activeTab === 'shared' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('personal')}
          className={`pb-3 font-medium text-sm transition-colors relative ${
            activeTab === 'personal' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          My Personal Files
          {activeTab === 'personal' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />
          )}
        </button>
      </div>

      <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50/50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Owner</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Size</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 size={20} className="animate-spin text-indigo-600" />
                      Loading files...
                    </div>
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No files found in this folder.
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr key={file.id} className="hover:bg-white/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <FileIcon size={20} />
                        </div>
                        <span className="font-medium text-slate-700">
                          {file.metadata?.original_name || file.name.split('_').slice(1).join('_') || file.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {file.metadata?.owner_name || (activeTab === 'personal' ? 'Me' : 'Unknown')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{formatDate(file.created_at)}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{formatSize(file.metadata?.size || 0)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleDownload(file.name)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                        {/* <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Share2 size={16} /></button> */}
                        {/* <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><MoreHorizontal size={16} /></button> */}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Files;
