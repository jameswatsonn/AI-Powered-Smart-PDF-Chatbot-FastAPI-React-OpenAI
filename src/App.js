import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, FileText, Trash2, AlertCircle, CheckCircle, Loader, Plus, ArrowUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

const API_BASE = '/api/v1';

const KnowledgeModes = {
  strict: {
    name: 'Strict RAG',
    description: 'Answers only from PDFs',
    icon: '🔒'
  },
  augmented: {
    name: 'Augmented',
    description: 'PDFs + AI knowledge',
    icon: '📊'
  },
  expert: {
    name: 'Expert Analysis',
    description: 'Deep analysis & insights',
    icon: '🎓'
  }
};

// Markdown components with custom styling
const MarkdownComponents = {
  // Paragraphs
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  
  // Headings
  h1: ({ children }) => <h1 className="text-2xl font-bold mb-3 text-neutral-100">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-bold mb-3 text-neutral-100">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 text-neutral-100">{children}</h3>,
  
  // Lists
  ul: ({ children }) => (
    <ul className="list-disc mb-3 space-y-1 pl-6">
      {children}
    </ul>
  ),
  
  ol: ({ children }) => (
    <ol className="list-decimal mb-3 space-y-1 pl-6">
      {children}
    </ol>
  ),
  
  li: ({ children }) => (
    <li className="ml-0 pl-2">
      {children}
    </li>
  ),
  
  // Code blocks
  // Code blocks - REPLACE THIS ENTIRE SECTION
  code: ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeContent = String(children).replace(/\n$/, '');
    
    // Detect if this is a single-line code block masquerading as a block
    const isSingleLine = !match && !codeContent.includes('\n') && codeContent.length < 100;
    
    // Treat inline code OR single-line blocks as inline
    if (inline || isSingleLine) {
      return (
        <code 
          style={{
            display: 'inline',
            backgroundColor: '#525252',
            color: '#e5e5e5',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '13px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            verticalAlign: 'baseline'
          }}
          {...props}
        >
          {children}
        </code>
      );
    }
    
    // Block code with syntax highlighting (has language tag)
    if (match) {
      return (
        <div className="my-4 rounded-lg overflow-hidden border border-neutral-600/50 shadow-lg">
          <SyntaxHighlighter
            style={oneDark}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: '0.5rem',
              padding: '1rem',
              fontSize: '0.875rem',
              lineHeight: '1.6',
            }}
            {...props}
          >
            {codeContent}
          </SyntaxHighlighter>
        </div>
      );
    }
    
    // Fallback for actual multi-line code blocks without language
    return (
      <div className="my-4 rounded-lg overflow-hidden border border-neutral-600/50 shadow-lg">
        <pre className="bg-neutral-900 text-neutral-100 p-4 rounded-lg overflow-x-auto">
          <code className="font-mono text-sm" {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  },


  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-neutral-600 pl-4 italic mb-3 text-neutral-300">
      {children}
    </blockquote>
  ),
  
  // Links
  a: ({ children, href }) => (
    <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  
  // Strong/Bold
  strong: ({ children }) => <strong className="font-bold text-neutral-100">{children}</strong>,
  
  // Emphasis/Italic
  em: ({ children }) => <em className="italic">{children}</em>,
  
  // Horizontal rule
  hr: () => <hr className="border-neutral-700 my-4" />,
  
  // Tables
  // Tables - IMPROVED VERSION
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded-lg border border-neutral-600/50">
      <table className="min-w-full border-collapse">
        {children}
      </table>
    </div>
  ),

  thead: ({ children }) => (
    <thead className="bg-neutral-800">
      {children}
    </thead>
  ),

  tbody: ({ children }) => (
    <tbody className="bg-neutral-900/50 divide-y divide-neutral-700">
      {children}
    </tbody>
  ),

  tr: ({ children }) => (
    <tr className="hover:bg-neutral-800/30 transition-colors">
      {children}
    </tr>
  ),

  th: ({ children }) => (
    <th className="px-4 py-3 text-left font-semibold text-neutral-100 border-b-2 border-neutral-600">
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td className="px-4 py-3 text-neutral-200">
      {children}
    </td>
  ),
};

// Typewriter Hook
function useTypewriter(text, speed = 30, trigger) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);
    let index = 0;

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, trigger]);

  return { displayedText, isTyping };
}

export default function PDFChatbot() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [documents, setDocuments] = useState([]);
  const [knowledgeMode, setKnowledgeMode] = useState('augmented');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState(null);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [typingTrigger, setTypingTrigger] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const modeMenuRef = useRef(null);
  const mainAreaRef = useRef(null);

  const titleText = "Ready to chat with your PDFs";
  const descriptionText = `Upload some PDF documents and ask questions. I'll help you find information using ${KnowledgeModes[knowledgeMode].name} mode.`;

  const { displayedText: displayedTitle, isTyping: isTitleTyping } = useTypewriter(titleText, 40, typingTrigger);
  const { displayedText: displayedDescription } = useTypewriter(
    descriptionText, 
    20, 
    isTitleTyping ? -1 : typingTrigger
  );

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target)) {
        setShowModeMenu(false);
      }
    };

    if (showModeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModeMenu]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE}/documents`);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const processFiles = async (files) => {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      setError('Please upload PDF files only');
      return;
    }

    setUploadProgress({ total: pdfFiles.length, completed: 0 });
    setError(null);

    for (const file of pdfFiles) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        
        if (data.success) {
          setUploadProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
        } else {
          setError(`Failed to upload ${file.name}: ${data.error || 'Unknown error'}`);
        }
      } catch (error) {
        setError(`Error uploading ${file.name}: ${error.message}`);
      }
    }

    await fetchDocuments();
    setUploadProgress(null);
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    await processFiles(files);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag and Drop Handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  const handleDeleteDocument = async (pdfId, pdfName) => {
    if (!window.confirm(`Delete "${pdfName}"?`)) return;

    try {
      const response = await fetch(`${API_BASE}/documents/${pdfId}`, {
        method: 'DELETE',
      });
    
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`);
      }
    
      const data = await response.json();
    
      if (data.success) {
        await fetchDocuments();
        setError(null);
      } else {
        setError(data.error || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Delete error:', error);
      setError(`Failed to delete document: ${error.message}`);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: inputMessage,
          knowledge_mode: knowledgeMode,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage = {
          role: 'assistant',
          content: data.answer,
          timestamp: data.timestamp,
          metadata: {
            mode: data.knowledge_mode,
            sources: data.sources_used,
            searchResults: data.search_results_count,
            tokenUsage: data.token_usage
          }
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        setError(data.error || 'Failed to get response');
      }
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleModeSelect = (mode) => {
    setKnowledgeMode(mode);
    setShowModeMenu(false);
    setTypingTrigger(prev => prev + 1);
  };

  const handleSidebarModeChange = (mode) => {
    setKnowledgeMode(mode);
    setTypingTrigger(prev => prev + 1);
  };

  return (
    <div className="flex h-screen bg-neutral-900">
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 40px rgba(255, 255, 255, 0.1), inset 0 0 60px rgba(255, 255, 255, 0.05);
          }
          50% {
            box-shadow: 0 0 80px rgba(255, 255, 255, 0.2), inset 0 0 100px rgba(255, 255, 255, 0.1);
          }
        }
        
        @keyframes floatIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        .typing-cursor {
          display: inline-block;
          width: 2px;
          height: 1em;
          background-color: currentColor;
          margin-left: 2px;
          animation: blink 1s step-end infinite;
          vertical-align: text-bottom;
        }
        
        /* KaTeX display mode styling */
        .katex-display {
          margin: 1em 0 !important;
          overflow-x: auto;
          overflow-y: hidden;
        }
        
        .katex-display > .katex {
          text-align: center;
        }
        
        /* Inline math styling */
        .katex {
          font-size: 1.05em;
        }
        
        /* Liquid Glass Overlay */
        .liquid-glass-overlay {
          position: absolute;
          inset: 0;
          z-index: 50;
          pointer-events: none;
        }
        
        .liquid-glass-overlay.active {
          pointer-events: auto;
        }
        
        .liquid-glass-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
          border: 1px solid rgba(255, 255, 255, 0);
          opacity: 0;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .liquid-glass-overlay.active .liquid-glass-backdrop {
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          opacity: 1;
        }
        
        .liquid-glass-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.1) 0%,
            transparent 50%,
            rgba(255, 255, 255, 0.05) 100%
          );
          opacity: 0;
          transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .liquid-glass-overlay.active .liquid-glass-shimmer {
          opacity: 0.6;
        }
        
        .drop-zone-content {
          opacity: 0;
          transform: scale(0.9) translateY(20px);
          transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, 
                      transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s;
        }
        
        .liquid-glass-overlay.active .drop-zone-content {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
        
        .drop-zone-ring {
          animation: pulseGlow 2.5s ease-in-out infinite;
          background: rgba(255, 255, 255, 0.08) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
        }
        
        /* Custom scrollbar styles - remove arrows */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        /* Remove scrollbar buttons/arrows */
        ::-webkit-scrollbar-button {
          display: none;
          width: 0;
          height: 0;
        }
        
        /* Hide scrollbar for textarea by default, show on hover */
        .custom-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          display: none;
        }
        
        .custom-scrollbar:hover {
          scrollbar-width: thin;
        }
        
        .custom-scrollbar:hover::-webkit-scrollbar {
          display: block;
          width: 4px;
        }
        
        .custom-scrollbar:hover::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        
        .custom-scrollbar:hover::-webkit-scrollbar-button {
          display: none;
          width: 0;
          height: 0;
        }
        
        /* Firefox scrollbar */
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }
      `}</style>
      {/* Sidebar */}
      <div 
        className={`bg-neutral-800 border-r border-neutral-700 flex flex-col transition-all duration-300 ${
          sidebarVisible ? 'w-72' : 'w-0 border-r-0'
        } overflow-hidden`}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-700">
          <h1 className="text-xl font-bold text-white whitespace-nowrap">PDF Chatbot</h1>
          <p className="text-sm text-neutral-400 mt-1 whitespace-nowrap">Chat with your documents</p>
        </div>

        {/* Knowledge Mode Selector */}
        <div className="p-4 border-b border-neutral-700">
          <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2 block">
            Knowledge Mode
          </label>
          <div className="space-y-2">
            {Object.entries(KnowledgeModes).map(([key, mode]) => (
              <button
                key={key}
                onClick={() => handleSidebarModeChange(key)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  knowledgeMode === key
                    ? 'border-neutral-500 bg-neutral-700'
                    : 'border-neutral-700 hover:border-neutral-600 bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{mode.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-white">{mode.name}</div>
                    <div className="text-xs text-neutral-400 truncate">{mode.description}</div>
                  </div>
                  {knowledgeMode === key && (
                    <CheckCircle className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Upload Section */}
        <div className="p-4 border-b border-neutral-700">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress !== null}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neutral-200 text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {uploadProgress ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Uploading {uploadProgress.completed}/{uploadProgress.total}
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload PDF
              </>
            )}
          </button>
        </div>

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
              Documents ({documents.length})
            </h2>
          </div>
          
          {documents.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No documents uploaded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.pdf_id}
                  className="group p-3 bg-neutral-700 rounded-lg hover:bg-neutral-650 transition-colors border border-neutral-700"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {doc.pdf_name}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {doc.chunk_count} chunks • {doc.pages?.length || 0} pages
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.pdf_id, doc.pdf_name)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-600 rounded transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div 
        ref={mainAreaRef}
        className="flex-1 flex flex-col relative overflow-hidden"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Liquid Glass Drop Overlay */}
        <div className={`liquid-glass-overlay ${isDragOver ? 'active' : ''}`}>
          <div className="liquid-glass-backdrop" />
          <div className="liquid-glass-shimmer" />
          
          {/* Drop Zone Content */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="drop-zone-content text-center">
              <div 
                className="drop-zone-ring inline-flex items-center justify-center w-28 h-28 rounded-full mb-6"
              >
                <Upload className="w-10 h-10 text-white/70" />
              </div>
              <h3 className="text-xl font-medium text-white/90 mb-2">
                Drop PDF files here
              </h3>
              <p className="text-white/50 text-sm">
                Release to upload your documents
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setSidebarVisible(!sidebarVisible)}
          className="absolute top-4 left-4 z-20 p-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors shadow-lg"
          title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
        >
          <svg 
            className={`w-5 h-5 text-neutral-200 transition-transform duration-300 ${sidebarVisible ? '' : 'rotate-180'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Dynamic Background - Only shows when no messages */}
        {messages.length === 0 && (
          <div className="absolute inset-0 z-0">
            {/* Main gradient background */}
            <div 
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse at center, 
                    rgba(30, 40, 70, 1) 0%,
                    rgba(87, 113, 166, 1) 25%,
                    rgba(159, 127, 215, 1) 55%,
                    rgba(243, 93, 190, 1) 85%,
                    rgba(243, 93, 190, 0.9) 100%
                  )
                `
              }}
            />
            {/* Bottom orange band */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-64"
              style={{
                background: 'linear-gradient(to bottom, rgba(254, 105, 29, 0) 0%, rgba(254, 105, 29, 0.3) 30%, rgba(254, 105, 29, 0.7) 60%, rgba(254, 105, 29, 1) 80%, rgba(232, 90, 16, 1) 100%)'
              }}
            />
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-neutral-800 border-b border-neutral-700 p-3 flex items-center gap-2 relative z-10">
            <AlertCircle className="w-5 h-5 text-neutral-300 flex-shrink-0" />
            <p className="text-sm text-neutral-200 flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-neutral-400 hover:text-neutral-200"
            >
              ×
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 relative z-10">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 ? (
              <div className="text-center flex items-center justify-center h-full" style={{ minHeight: 'calc(100vh - 200px)' }}>
                <div className="bg-transparent rounded-3xl p-12">
                  <div className="inline-block p-6 bg-neutral-800/60 rounded-full mb-6 border border-neutral-700/50">
                    <FileText className="w-16 h-16 text-neutral-200" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-3">
                    {displayedTitle}
                    {isTitleTyping && <span className="typing-cursor" />}
                  </h2>
                  <p className="text-neutral-300 max-w-md mx-auto text-lg">
                    {!isTitleTyping && displayedDescription}
                    {!isTitleTyping && displayedDescription.length < descriptionText.length && <span className="typing-cursor" />}
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={index}>
                  {message.role === 'user' ? (
                    <div className="rounded-2xl px-4 py-3 w-fit max-w-2xl bg-neutral-700 text-neutral-100 ml-auto border border-neutral-600">
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>
                  ) : (
                    <div className="w-fit max-w-2xl">
                      <div className="max-w-none text-neutral-100">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[rehypeKatex]}
                          components={MarkdownComponents}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      
                      {message.metadata && (
                        <div className="mt-3 pt-3 border-t border-neutral-700/50 text-xs text-neutral-400">
                          <div className="flex items-center gap-4 flex-wrap">
                            <span className="flex items-center gap-1">
                              {KnowledgeModes[message.metadata.mode]?.icon}
                              {KnowledgeModes[message.metadata.mode]?.name}
                            </span>
                            {message.metadata.searchResults > 0 && (
                              <span>{message.metadata.searchResults} sources</span>
                            )}
                            {message.metadata.tokenUsage && (
                              <span>{message.metadata.tokenUsage.total} tokens</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            
            {isLoading && (
              <div>
                <div className="bg-neutral-800 border border-neutral-700 rounded-2xl px-4 py-3 w-fit max-w-2xl">
                  <div className="flex items-center gap-2">
                    <Loader className="w-4 h-4 animate-spin text-neutral-400" />
                    <span className="text-neutral-300">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area - Centered */}
        <div className="p-4 pb-8 relative z-10">
          <div className="max-w-2xl mx-auto relative">
            {/* Mode Menu */}
            {showModeMenu && (
              <div 
                ref={modeMenuRef}
                className="absolute bottom-full left-0 mb-2 rounded-2xl shadow-2xl overflow-hidden z-10 animate-slideUp"
                style={{ 
                  minWidth: '280px',
                  background: 'rgba(30, 30, 30, 0.7)',
                  backdropFilter: 'blur(40px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
                  animation: 'slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                }}
              >
                {/* Upload Section */}
                <div className="border-b border-white/10">
                  <div className="px-3 py-2">
                    <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                      Upload
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowModeMenu(false);
                    }}
                    disabled={uploadProgress !== null}
                    className="w-full text-left p-3 hover:bg-white/5 transition-colors flex items-center gap-3 disabled:opacity-50"
                  >
                    <Upload className="w-5 h-5 text-neutral-300" />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-white">Upload PDF</div>
                      <div className="text-xs text-neutral-400">Add documents to chat with</div>
                    </div>
                  </button>
                </div>

                {/* Knowledge Mode Section */}
                <div>
                  <div className="px-3 py-2">
                    <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                      Knowledge Mode
                    </h3>
                  </div>
                  {Object.entries(KnowledgeModes).map(([key, mode]) => (
                    <button
                      key={key}
                      onClick={() => handleModeSelect(key)}
                      className={`w-full text-left p-3 transition-colors flex items-center gap-3 ${
                        knowledgeMode === key
                          ? 'bg-white/10 border-l-2 border-white/30'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <span className="text-xl">{mode.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-neutral-200">{mode.name}</div>
                        <div className="text-xs text-neutral-400">{mode.description}</div>
                      </div>
                      {knowledgeMode === key && (
                        <CheckCircle className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Container */}
            <div className="relative flex items-start gap-2 bg-neutral-800 border border-neutral-700 rounded-3xl px-2 py-2">
              {/* Plus/Mode Button */}
              <button
                onClick={() => setShowModeMenu(!showModeMenu)}
                disabled={isLoading}
                className="flex-shrink-0 p-2 text-white hover:text-neutral-100 hover:bg-neutral-700 rounded-full transition-colors disabled:opacity-50 mt-0.5"
                title="Change mode"
              >
                <Plus className="w-5 h-5" />
              </button>

              {/* Text Input */}
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={documents.length === 0 ? 'Upload a PDF to start chatting...' : 'Ask anything...'}
                disabled={isLoading || documents.length === 0}
                rows={1}
                className="flex-1 bg-transparent px-2 py-2 text-neutral-100 placeholder-neutral-500 focus:outline-none disabled:text-neutral-600 resize-none overflow-y-auto custom-scrollbar"
                style={{ maxHeight: '150px' }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                }}
              />

              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading || documents.length === 0}
                className="flex-shrink-0 p-2 bg-neutral-200 text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-0.5"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
            </div>

            {/* Status Text */}
            <div className={`mt-2 text-xs text-center transition-colors ${messages.length === 0 ? 'text-neutral-800' : 'text-white'}`}>
              {documents.length} document{documents.length !== 1 ? 's' : ''} loaded • {KnowledgeModes[knowledgeMode].name} mode
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}