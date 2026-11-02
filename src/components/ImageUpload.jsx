import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const BUCKET_NAME = 'product-images';

export default function ImageUpload({
  value,
  onChange,
  className = '',
  size = 'md', // 'sm', 'md', 'lg'
  folder = 'products', // path inside the bucket: 'products' or 'logos'
  fit = 'cover', // 'cover' for product photos, 'contain' for logos
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const uploadImage = async (file) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        // If bucket doesn't exist, show helpful message
        if (uploadError.message?.includes('Bucket not found') || uploadError.statusCode === 404) {
          toast.error(
            'Storage not configured. Create a bucket named "product-images" in Supabase Storage.',
            { duration: 6000 }
          );
        } else {
          throw uploadError;
        }
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        onChange(urlData.publicUrl);
        toast.success('Image uploaded!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImage(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadImage(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const removeImage = () => {
    onChange('');
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {value ? (
        // Image preview
        <div className={`relative ${sizeClasses[size]} rounded-xl overflow-hidden group ${fit === 'contain' ? 'bg-white border border-slate-200 dark:border-slate-600' : ''}`}>
          <img
            src={value}
            alt=""
            className={`w-full h-full ${fit === 'contain' ? 'object-contain p-1' : 'object-cover'}`}
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
              disabled={uploading}
            >
              <Upload className="w-4 h-4 text-slate-700" />
            </button>
            <button
              type="button"
              onClick={removeImage}
              className="p-2 bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      ) : (
        // Upload area
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          disabled={uploading}
          className={`${sizeClasses[size]} rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-1 ${
            dragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50 dark:bg-slate-800'
          } ${uploading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          ) : (
            <>
              <ImageIcon className="w-6 h-6 text-slate-400" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Upload
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

