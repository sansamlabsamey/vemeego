import React, { useState, useEffect } from 'react';
import { File, Download, Loader2, Image as ImageIcon } from 'lucide-react';
import { api } from '../../utils/api';

interface FileAttachmentProps {
  path: string;
  name: string;
  size?: number;
  type?: string;
  bucket?: string;
}

const FileAttachment: React.FC<FileAttachmentProps> = ({ path, name, size, type, bucket = 'chat-files' }) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchUrl = async () => {
      // If it's an image, we want to load it immediately
      if (type?.startsWith('image/')) {
        try {
          setLoading(true);
          const { data } = await api.post('/storage/url', {
            bucket,
            path
          });
          if (isMounted && data?.signedURL) {
            setSignedUrl(data.signedURL);
          }
        } catch (err) {
          console.error('Failed to load image:', err);
          if (isMounted) setError(true);
        } finally {
          if (isMounted) setLoading(false);
        }
      }
    };

    fetchUrl();

    return () => {
      isMounted = false;
    };
  }, [path, bucket, type]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoading(true);
      // Always fetch a fresh URL for download to ensure it hasn't expired
      const { data } = await api.post('/storage/url', {
        bucket,
        path
      });
      
      if (data?.signedURL) {
        const a = document.createElement('a');
        a.href = data.signedURL;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Failed to download file:', err);
      alert('Failed to download file');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (type?.startsWith('image/')) {
    if (loading && !signedUrl) {
      return (
        <div className="flex items-center justify-center w-48 h-32 bg-slate-100 rounded-lg">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      );
    }
    
    if (error || !signedUrl) {
      return (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-600">
          <ImageIcon size={20} />
          <span className="text-sm">Failed to load image</span>
        </div>
      );
    }

    return (
      <div className="relative group">
        <img 
          src={signedUrl} 
          alt={name} 
          className="max-w-sm max-h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(signedUrl, '_blank')}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg max-w-sm">
      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
        <File size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate" title={name}>{name}</p>
        <p className="text-xs text-slate-500">{formatSize(size)}</p>
      </div>
      <button 
        onClick={handleDownload}
        disabled={loading}
        className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
        title="Download"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      </button>
    </div>
  );
};

export default FileAttachment;
