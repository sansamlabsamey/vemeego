import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { api } from '../utils/api';

interface AvatarProps {
  url?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ url, name, size = 'md', className = '' }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSignedUrl = async () => {
      if (!url) {
        setImgSrc(null);
        return;
      }

      // If it's already a full URL (e.g. from Google Auth or public bucket), use it
      if (url.startsWith('http')) {
        setImgSrc(url);
        return;
      }

      // Otherwise, assume it's a path in the 'avatars' bucket and fetch signed URL
      try {
        const { data } = await api.post('/storage/url', {
          bucket: 'avatars',
          path: url
        });
        
        if (isMounted && data?.signedURL) {
          setImgSrc(data.signedURL);
        }
      } catch (error) {
        console.error('Failed to load avatar:', error);
        // Fallback to initials if error
        if (isMounted) setImgSrc(null);
      }
    };

    fetchSignedUrl();

    return () => {
      isMounted = false;
    };
  }, [url]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-20 h-20 text-xl',
    xl: 'w-32 h-32 text-2xl'
  };

  if (!imgSrc) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold ${className}`}>
        {name ? name.charAt(0).toUpperCase() : <User />}
      </div>
    );
  }

  return (
    <img 
      src={imgSrc} 
      alt={name} 
      className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
    />
  );
};

export default Avatar;
