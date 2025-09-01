"use client"

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip, X, Sparkles, Bot, User, Loader2, Check, AlertTriangle, Download, ZoomIn } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import ReactMarkdown from 'react-markdown';

interface FileAttachment {
  id: string;
  type: 'file';
  mediaType: string;
  url: string;
  name: string;
  size: number;
  status: 'uploading' | 'uploaded' | 'error';
  progress: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const FileAttachmentPreview = React.memo(({
  attachment,
  onRemove
}: {
  attachment: FileAttachment;
  onRemove: () => void;
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    className="relative group w-48"
  >
    <div className="flex items-center gap-3 px-3 py-2 rounded-2xl border bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all overflow-hidden">
      {attachment.mediaType.startsWith('image/') ? (
        <img
          // Use blob URL for uploaded images, otherwise an empty placeholder
          src={attachment.status === 'uploaded' ? attachment.url : URL.createObjectURL(new Blob())}
          alt={attachment.name}
          className="w-8 h-8 rounded-lg object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
          <Paperclip className="w-4 h-4 text-gray-400" />
        </div>
      )}

      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm text-white truncate">{attachment.name}</span>
        {attachment.status === 'uploading' ? (
          <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
            <div
              className="bg-blue-500 h-1 rounded-full transition-all"
              style={{ width: `${attachment.progress}%` }}
            />
          </div>
        ) : attachment.status === 'error' ? (
          <span className="text-xs text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Failed
          </span>
        ) : (
          <span className="text-xs text-gray-500">{formatFileSize(attachment.size)}</span>
        )}
      </div>

      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded-lg"
      >
        <X className="w-3 h-3 text-gray-400" />
      </button>
    </div>
  </motion.div>
));

// Detached full-width tool display (unchanged from original)
const DetachedToolDisplay = React.memo(({ toolName, isComplete }: { toolName: string; isComplete?: boolean; }) => (
  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="w-full mb-4">
    <div className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
      {!isComplete ? (
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Sparkles className="w-4 h-4 text-blue-400" />
        </motion.div>
      ) : (<Check className="w-4 h-4 text-green-400/60" />)}
      <span className="text-sm text-gray-300">{toolName.replace('tool-', '').replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
    </div>
  </motion.div>
));

// Processing loader (unchanged from original)
const ProcessingLoader = React.memo(() => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center mb-4">
    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm">
      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
      <span className="text-sm text-gray-300">Processing</span>
    </div>
  </motion.div>
));

// Image Modal Component
const ImageModal = React.memo(({
  src,
  alt,
  isOpen,
  onClose
}: {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = alt || 'image';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [src, alt]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative max-w-5xl h-[80vh] w-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              onClick={handleDownload}
              className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors backdrop-blur-sm"
            >
              <Download className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors backdrop-blur-sm"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-xl"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

// Custom Image Component for ReactMarkdown
const CustomImage = React.memo(({
  src,
  alt,
  onImageClick
}: {
  src?: string;
  alt?: string;
  onImageClick: (src: string, alt: string) => void;
}) => {
  if (!src) return null;

  return (
    <div className="relative group inline-block my-2">
      <img
        src={src}
        alt={alt || ''}
        className="max-h-96 w-auto rounded-xl border border-white/10 cursor-zoom-in hover:border-white/30 transition-all"
        onClick={() => onImageClick(src, alt || '')}
      />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-xl pointer-events-none">
        <div className="p-2 rounded-full bg-white/20 backdrop-blur-sm">
          <ZoomIn className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
});

// Chat message component (modified to include custom image handling)
const ChatMessage = React.memo(({ message, onImageClick }: { message: any; onImageClick: (src: string, alt: string) => void; }) => {
  console.log(message)
  const isUser = message.role === 'user';
  const toolCalls = message.parts.filter((part: any) => part.type && part.type.startsWith('tool-'));
  const contentParts = message.parts.filter((part: any) => part.type === 'text' || part.type === 'file');

  return (
    <div className="w-full mb-6">
      {toolCalls.map((part: any, index: number) => (<DetachedToolDisplay key={index} toolName={part.type} isComplete={part.state === 'output-available'} />))}
      {contentParts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          {isUser ? (
            <div className="w-full mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0"><User className="w-3 h-3 text-white" /></div>
                <span className="text-sm font-medium text-blue-400">You</span>
              </div>
              <div className="w-full p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                {contentParts.map((part: any, index: number) => {
                  if (part.type === 'text') return <div key={index} className="text-white/90 leading-relaxed whitespace-pre-wrap break-words">{part.text}</div>;
                  if (part.type === 'file' && part.mediaType?.startsWith('image/')) return <img key={index} src={part.url} alt="Uploaded image" className="max-w-sm rounded-xl mt-3 border border-white/10" />;
                  return null;
                })}
              </div>
            </div>
          ) : (
            <div className="w-full mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0"><Bot className="w-3 h-3 text-gray-400" /></div>
                <span className="text-sm font-medium text-gray-400">Assistant</span>
              </div>
              <div className="w-full">
                {contentParts.map((part: any, index: number) => {
                  if (part.type === 'text') return <div key={index} className="text-white/90 leading-relaxed whitespace-pre-wrap break-words text-[15px]" style={{ lineHeight: '1.6' }}>
                    <ReactMarkdown
                      components={{
                        img: ({ src, alt }) => (
                          <CustomImage
                            src={src as string}
                            alt={alt}
                            onImageClick={onImageClick}
                          />
                        )
                      }}
                    >
                      {part.text}
                    </ReactMarkdown>
                  </div>;
                  if (part.type === 'file' && part.mediaType?.startsWith('image/')) return <img key={index} src={part.url} alt="Generated image" className="max-w-md rounded-xl mt-3 border border-white/10" />;
                  return null;
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
});

// Streaming indicator (unchanged from original)
const StreamingIndicator = React.memo(() => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 mb-8">
    <div className="flex-shrink-0 w-8 h-8 rounded-2xl flex items-center justify-center bg-white/10"><Bot className="w-4 h-4 text-gray-300" /></div>
    <div className="px-4 py-3 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10">
      <div className="flex items-center gap-2">
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}><div className="w-2 h-2 rounded-full bg-blue-400" /></motion.div>
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}><div className="w-2 h-2 rounded-full bg-blue-400" /></motion.div>
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}><div className="w-2 h-2 rounded-full bg-blue-400" /></motion.div>
      </div>
    </div>
  </motion.div>
));

// --- MAIN CHAT COMPONENT ---
const AIChat = () => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_FILES = 3;

  // Modal handlers
  const handleImageClick = useCallback((src: string, alt: string) => {
    setModalImage({ src, alt });
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalImage(null);
  }, []);

  const { messages, sendMessage, status, error, stop, addToolResult } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    experimental_throttle: 50,
    onFinish: () => { setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100); },
    onError: (error) => { console.error('Chat error:', error); },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) {
        return;
      }

      if (toolCall.toolName) {
        addToolResult({
          tool: 'tool',
          toolCallId: toolCall.toolCallId,
          output: "",
        });
      }
    },
  });

  // NEW: File upload logic using XMLHttpRequest for progress tracking
  const uploadFile = useCallback((file: File, id: string) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        setAttachments(prev => prev.map(att => att.id === id ? { ...att, progress: percentage } : att));
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        setAttachments(prev => prev.map(att => att.id === id ? { ...att, status: 'uploaded', url: response.url, progress: 100 } : att));
      } else {
        setAttachments(prev => prev.map(att => att.id === id ? { ...att, status: 'error' } : att));
        console.error('Upload failed:', xhr.statusText);
      }
    };
    xhr.onerror = () => {
      setAttachments(prev => prev.map(att => att.id === id ? { ...att, status: 'error' } : att));
      console.error('Upload error:', xhr.statusText);
    };
    xhr.open('POST', `/api/upload-blob?filename=${encodeURIComponent(file.name)}`, true);
    xhr.send(file);
  }, []);

  const handleRemoveAttachment = useCallback(async (idToRemove: string) => {
    const attachmentToRemove = attachments.find(a => a.id === idToRemove);
    setAttachments(prev => prev.filter(a => a.id !== idToRemove));
    if (attachmentToRemove && attachmentToRemove.status === 'uploaded' && attachmentToRemove.url) {
      try {
        await fetch('/api/delete-blob', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: attachmentToRemove.url }),
        });
      } catch (error) {
        console.error('Failed to delete blob:', error);
      }
    }
  }, [attachments]);

  const handleFileUpload = useCallback(async (files: FileList) => {
    if (attachments.length + files.length > MAX_FILES) {
      alert(`You can only upload a maximum of ${MAX_FILES} files.`);
      return;
    }
    const newAttachmentsToUpload = Array.from(files).map(file => ({
      id: `${file.name}-${Date.now()}`,
      type: 'file' as const,
      mediaType: file.type,
      url: '', // Initially empty
      name: file.name,
      size: file.size,
      status: 'uploading' as const,
      progress: 0,
    }));
    setAttachments(prev => [...prev, ...newAttachmentsToUpload]);
    newAttachmentsToUpload.forEach((att, index) => uploadFile(files[index], att.id));
  }, [attachments.length, uploadFile]);

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      await handleFileUpload(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [handleFileUpload]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) await handleFileUpload(files);
  }, [handleFileUpload]);

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const isUploading = attachments.some(a => a.status === 'uploading');
    const uploadedFiles = attachments.filter(a => a.status === 'uploaded');

    if ((!input.trim() && uploadedFiles.length === 0) || status !== 'ready' || isUploading) {
      return;
    }

    const messageParts = [];
    const attachmentsForAI = uploadedFiles.map(({ id, status, progress, ...rest }) => rest);
    if (input.trim()) {
      let text = input.trim();
      if (attachmentsForAI.length !== 0) {
        text += `\n\nAttachments: ${attachmentsForAI.map(att => att.url).join(', ')}`;
      }
      messageParts.push({ type: 'text', text: text });
    }

    messageParts.push(...attachmentsForAI);
    sendMessage({ role: 'user', parts: messageParts as any });
    setInput('');
    setAttachments([]);
  }, [input, attachments, status, sendMessage]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, []);

  React.useEffect(() => {
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
  }, [messages]);

  React.useEffect(() => { adjustTextareaHeight(); }, [input, adjustTextareaHeight]);

  const isUploading = useMemo(() => attachments.some(att => att.status === 'uploading'), [attachments]);

  return (
    <div className="h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="relative z-10 border-b border-white/10 backdrop-blur-sm bg-black/50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-medium text-white">AI Assistant</h1>
              <p className="text-sm text-gray-400">Specialized in creating stunning thumbnails</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container (unchanged) */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="px-6 py-8">
            {messages.length === 0 ? (
              <div className="text-center py-20">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                  <div className="w-16 h-16 rounded-3xl mx-auto mb-6 bg-white/10 flex items-center justify-center">
                    <Bot className="w-8 h-8 text-gray-400" />
                  </div>
                  <h2 className="text-2xl font-light mb-3 text-white">Ready to create thumbnails?</h2>
                  <p className="text-gray-500 max-w-md mx-auto">Describe your vision or upload images to get started with custom thumbnail generation.</p>
                </motion.div>
              </div>
            ) : (
              <div>{messages.map(message => (<ChatMessage key={message.id} message={message} onImageClick={handleImageClick} />))}</div>
            )}
            <AnimatePresence>{status === 'submitted' && <ProcessingLoader />}</AnimatePresence>
            <AnimatePresence>{status === 'streaming' && <StreamingIndicator />}</AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <div className="relative z-10 border-t border-white/10 backdrop-blur-sm bg-black/50">
        <div className="max-w-4xl mx-auto p-6">
          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 flex flex-wrap gap-3"
              >
                {attachments.map((attachment) => (
                  <FileAttachmentPreview key={attachment.id} attachment={attachment} onRemove={() => handleRemoveAttachment(attachment.id)} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSend}>
            <div
              className={`flex items-end gap-3 p-4 rounded-3xl border transition-all ${isDragging ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' : 'border-white/20 bg-white/5 hover:bg-white/10'} backdrop-blur-sm`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleDrop}
            >
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isUploading ? 'Uploading files...' : isDragging ? 'Drop files here...' : 'Describe your thumbnail idea...'}
                  disabled={status !== 'ready' || isUploading}
                  rows={1}
                  className="w-full bg-transparent resize-none focus:outline-none text-white placeholder-gray-500 text-sm"
                  style={{ minHeight: '20px', maxHeight: '120px' }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
                />
              </div>

              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf,text/*" onChange={handleFileInputChange} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={status !== 'ready' || isUploading || attachments.length >= MAX_FILES} className="p-2 rounded-2xl hover:bg-white/10 transition-colors disabled:opacity-50">
                  <Paperclip className="w-4 h-4 text-gray-400" />
                </button>

                {status === 'streaming' ? (
                  <button type="button" onClick={stop} className="px-4 py-2 rounded-2xl bg-red-500 text-white hover:bg-red-600 transition-colors text-sm">Stop</button>
                ) : (
                  <button
                    type="submit"
                    disabled={isUploading || status !== 'ready' || (!input.trim() && attachments.filter(a => a.status === 'uploaded').length === 0)}
                    className="px-4 py-2 rounded-2xl bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm w-[75px] flex justify-center items-center"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Image Modal */}
      <ImageModal
        src={modalImage?.src || ''}
        alt={modalImage?.alt || ''}
        isOpen={!!modalImage}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default AIChat;
