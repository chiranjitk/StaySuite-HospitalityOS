'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { 
  ImagePlus, 
  X, 
  Upload, 
  Loader2, 
  ImageOff,
  Move,
  Star
} from 'lucide-react';

interface RoomImageGalleryProps {
  roomId: string;
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export function RoomImageGallery({ 
  roomId, 
  images, 
  onImagesChange,
  maxImages = 10 
}: RoomImageGalleryProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    if (filesToUpload.length < files.length) {
      toast({
        title: 'Limit reached',
        description: `Only ${remainingSlots} more images can be added (max ${maxImages})`,
        variant: 'destructive',
      });
    }

    setUploading(true);

    try {
      const uploadPromises = filesToUpload.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'rooms');

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        
        if (result.success) {
          return result.data.url;
        }
        return null;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const successfulUploads = uploadedUrls.filter(Boolean) as string[];

      if (successfulUploads.length > 0) {
        onImagesChange([...images, ...successfulUploads]);
        toast({
          title: 'Images uploaded',
          description: `${successfulUploads.length} image(s) uploaded successfully`,
        });
      }

      if (successfulUploads.length < filesToUpload.length) {
        toast({
          title: 'Some uploads failed',
          description: 'Please try again with different files',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload images',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async (index: number) => {
    const imageUrl = images[index];
    
    try {
      // Delete from server
      await fetch(`/api/upload?url=${encodeURIComponent(imageUrl)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Delete error:', error);
    }

    const newImages = [...images];
    newImages.splice(index, 1);
    onImagesChange(newImages);
    
    toast({
      title: 'Image removed',
      description: 'Image has been removed from the gallery',
    });
  };

  const handleSetPrimary = (index: number) => {
    if (index === 0) return;
    
    const newImages = [...images];
    const [image] = newImages.splice(index, 1);
    newImages.unshift(image);
    onImagesChange(newImages);
    
    toast({
      title: 'Primary image updated',
      description: 'Image set as primary (first in gallery)',
    });
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newImages = [...images];
    const [draggedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);
    onImagesChange(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <ImagePlus className="h-4 w-4" />
        {images.length > 0 ? `${images.length} Photos` : 'Add Photos'}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Room Photos</DialogTitle>
            <DialogDescription>
              Upload and manage room photos. Drag to reorder. First image is the primary photo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {/* Upload Area */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-6",
                "hover:border-primary/50 hover:bg-muted/50",
                uploading && "pointer-events-none opacity-50"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploading || images.length >= maxImages}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : images.length >= maxImages ? (
                <div className="flex flex-col items-center gap-2">
                  <ImageOff className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Maximum {maxImages} images reached</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload images
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG, WebP, GIF up to 5MB ({maxImages - images.length} slots remaining)
                  </p>
                </div>
              )}
            </div>

            {/* Image Grid */}
            {images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden border-2 group cursor-move",
                      draggedIndex === index && "opacity-50 border-primary",
                      index === 0 && "ring-2 ring-yellow-400"
                    )}
                  >
                    <img
                      src={image}
                      alt={`Room photo ${index + 1}`}
                      className="w-full h-full object-cover"
                      onClick={() => setSelectedImage(image)}
                    />
                    
                    {/* Overlay with actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {index !== 0 && (
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetPrimary(index);
                          }}
                          title="Set as primary"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(index);
                        }}
                        title="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Primary badge */}
                    {index === 0 && (
                      <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-xs font-medium px-2 py-0.5 rounded">
                        Primary
                      </div>
                    )}

                    {/* Drag handle indicator */}
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Move className="h-4 w-4 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ImageOff className="h-12 w-12 mx-auto mb-4" />
                <p>No photos uploaded yet</p>
                <p className="text-sm">Click the upload area to add photos</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox for viewing full image */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/90 border-none">
          <button
            className="absolute top-4 right-4 z-10 text-white hover:text-white/80"
            onClick={() => setSelectedImage(null)}
          >
            <X className="h-6 w-6" />
          </button>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Room photo"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
